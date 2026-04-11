import os
os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"
import json
import time
import requests
import base64
from email.message import EmailMessage
from pydantic import BaseModel
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
import google_auth_oauthlib.flow
from googleapiclient.discovery import build
from gmail_scraper import stop_gmail_polling, TOKENS_FILE, get_credentials, fetch_and_process_emails

router = APIRouter(prefix="/auth/gmail")

# ── URLs come from env so they work locally AND on Vercel ─────────────────────
# Strip trailing slashes to ensure redirect_uri exactly matches Google Console config
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000").rstrip("/")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:8080").rstrip("/")

class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str

class RulesRequest(BaseModel):
    spammer: list[str] = []
    always: list[str] = []
    never: list[str] = []

def _get_client_config():
    return {
        "web": {
            "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
            "project_id": "zen-scheduler",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
            "redirect_uris": [f"{BACKEND_URL}/auth/gmail/callback"],
        }
    }

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/gmail.send",
]

# Fallback in-memory store for local dev (serverless uses Supabase)
_LOCAL_STATES: dict = {}

def _get_supabase():
    """Lazily create a Supabase client if env vars are set."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        return None
    from supabase import create_client
    return create_client(url, key)

def _verify_env_vars():
    """Ensure all required environment variables are present."""
    required = [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "SUPABASE_URL",
        "SUPABASE_KEY",
        "GROQ_API_KEY"
    ]
    missing = [v for v in required if not os.environ.get(v)]
    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Missing required environment variables: {', '.join(missing)}. Please check your Vercel Dashboard."
        )

def _get_flow():
    _verify_env_vars()
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        _get_client_config(),
        scopes=SCOPES,
    )
    flow.redirect_uri = f"{BACKEND_URL}/auth/gmail/callback"
    return flow

def _save_oauth_state(state: str, code_verifier: str):
    """Persist OAuth state so it survives across serverless invocations."""
    supabase = _get_supabase()
    if supabase:
        try:
            supabase.table("oauth_states").upsert(
                {"state": state, "code_verifier": code_verifier, "created_at": int(time.time())}
            ).execute()
            return
        except Exception as e:
            print(f"Supabase state save error: {e}")
    # Local dev fallback
    _LOCAL_STATES[state] = {"verifier": code_verifier, "at": int(time.time())}

def _verify_and_consume_oauth_state(state: str) -> str:
    """Return code_verifier if state is valid (exists and < 10 min old), else empty, then delete it."""
    supabase = _get_supabase()
    if supabase:
        try:
            result = supabase.table("oauth_states").select("created_at", "code_verifier").eq("state", state).limit(1).execute()
            if not result.data:
                return ""
            row = result.data[0]
            created_at = row.get("created_at", 0)
            verifier = row.get("code_verifier", "")
            if int(time.time()) - created_at > 600:  # 10 min TTL
                supabase.table("oauth_states").delete().eq("state", state).execute()
                return ""
            supabase.table("oauth_states").delete().eq("state", state).execute()
            return verifier
        except Exception as e:
            print(f"Supabase state verify error: {e}")
            return ""
    # Local dev fallback
    data = _LOCAL_STATES.pop(state, None)
    if data is None:
        return ""
    if (int(time.time()) - data["at"]) > 600:
        return ""
    return data["verifier"]

@router.get("")
async def auth_gmail():
    flow = _get_flow()
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    # Important: flow.code_verifier is generated here, we MUST save it
    _save_oauth_state(state, flow.code_verifier)
    return RedirectResponse(authorization_url)

@router.get("/callback")
async def auth_gmail_callback(request: Request):
    try:
        code = request.query_params.get("code")
        state = request.query_params.get("state")

        if not code or not state:
            raise HTTPException(status_code=400, detail="Missing authorization code or state")

        # 1. Verify state and retrieve PKCE verifier from Supabase
        try:
            code_verifier = _verify_and_consume_oauth_state(state)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error during state verification: {str(e)}")

        if not code_verifier:
            raise HTTPException(
                status_code=400,
                detail="Authentication session expired or invalid. Please try connecting again.",
            )

        # 2. Token exchange
        try:
            # Recreate flow from config (no object needs to persist)
            flow = _get_flow()
            # We MUST provide the same verifier saved in Request 1
            flow.fetch_token(code=code, code_verifier=code_verifier)
            credentials = flow.credentials
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Google token exchange failed: {str(e)}")

        # 3. Fetch user email
        try:
            oauth2_client = build("oauth2", "v2", credentials=credentials)
            user_info = oauth2_client.userinfo().get().execute()
            user_email = user_info.get("email", "default_user@gmail.com")
        except Exception as e:
            print(f"Error fetching user email: {e}")
            user_email = "default_user@gmail.com"

        token_data = {
            "access_token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "last_checked": int(time.time()),
        }

        # 4. Persist tokens: Supabase (production) or local file (dev)
        supabase = _get_supabase()
        if supabase:
            try:
                supabase.table("gmail_tokens").upsert(
                    {"email": user_email, **token_data},
                    on_conflict="email",
                ).execute()
            except Exception as e:
                # We don't crash here, just log it. But if it's a critical DB error, maybe we should.
                print(f"Supabase token upsert error: {e}")
                # For debugging production: raise it
                raise HTTPException(status_code=500, detail=f"Failed to save tokens to Supabase: {str(e)}")
        else:
            # Local file fallback for development
            data = {}
            if os.path.exists(TOKENS_FILE):
                with open(TOKENS_FILE, "r") as f:
                    try:
                        data = json.load(f)
                    except json.JSONDecodeError:
                        data = {}
            data[user_email] = token_data
            with open(TOKENS_FILE, "w") as f:
                json.dump(data, f, indent=2)

        # Only start the background daemon in non-serverless (local) environments
        if not os.environ.get("VERCEL"):
            from gmail_scraper import start_gmail_polling
            start_gmail_polling(user_email)

        return RedirectResponse(f"{FRONTEND_URL}/?connected=true")

    except HTTPException as he:
        # Re-raise HTTP exceptions so FastAPI handles them
        raise he
    except Exception as e:
        # Catch-all for any other unexpected errors
        import traceback
        error_details = traceback.format_exc()
        print(f"CRITICAL OAUTH CALLBACK ERROR:\n{error_details}")
        raise HTTPException(
            status_code=500,
            detail=f"Unhandled internal error during login: {str(e)}. Check backend logs for full traceback."
        )

@router.get("/status")
async def auth_gmail_status():
    """Return Gmail connection status and database health."""
    status = {
        "connected": False,
        "email": None,
        "database_status": "disconnected",
        "database_error": None
    }
    
    # Check Supabase
    supabase = _get_supabase()
    if supabase:
        try:
            # Simple ping to test connectivity
            result = supabase.table("gmail_tokens").select("email").limit(1).execute()
            status["database_status"] = "ok"
            if result.data:
                status["connected"] = True
                status["email"] = result.data[0]["email"]
        except Exception as e:
            status["database_status"] = "error"
            status["database_error"] = str(e)
            print(f"Supabase status check error: {e}")
    else:
        # Check local file fallback (only for local dev)
        if not os.environ.get("VERCEL") and os.path.exists(TOKENS_FILE):
            try:
                with open(TOKENS_FILE, "r") as f:
                    data = json.load(f)
                    if data:
                        status["connected"] = True
                        status["email"] = list(data.keys())[-1]
                        status["database_status"] = "local"
            except Exception as e:
                print(f"Local token file error: {e}")

    return status

@router.post("/disconnect")
async def auth_gmail_disconnect():
    supabase = _get_supabase()
    if supabase:
        try:
            result = supabase.table("gmail_tokens").select("email").execute()
            for row in result.data:
                stop_gmail_polling(row["email"])
            supabase.table("gmail_tokens").delete().neq("email", "").execute()
        except Exception as e:
            print(f"Supabase disconnect error: {e}")
    elif os.path.exists(TOKENS_FILE):
        with open(TOKENS_FILE, "r") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                data = {}
        for user_email in data.keys():
            stop_gmail_polling(user_email)
        with open(TOKENS_FILE, "w") as f:
            json.dump({}, f, indent=2)

    return {"status": "success", "message": "Gmail disconnected."}

@router.post("/send-email")
async def send_email(req: SendEmailRequest):
    user_email, creds = _get_active_credentials()
    if not creds:
        raise HTTPException(status_code=401, detail="Invalid credentials. Please reconnect.")

    try:
        service = build("gmail", "v1", credentials=creds)
        msg = EmailMessage()
        msg.set_content(req.body)
        msg["To"] = req.to
        msg["Subject"] = req.subject

        encoded = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        service.users().messages().send(userId="me", body={"raw": encoded}).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync-emails")
async def sync_emails():
    user_email, creds = _get_active_credentials()
    if not creds:
        return {"status": "success", "emails_processed": 0}

    try:
        count = fetch_and_process_emails(user_email, manual_run=True)
        return {"status": "success", "emails_processed": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/rules")
async def get_rules():
    supabase = _get_supabase()
    if supabase:
        try:
            result = supabase.table("gmail_rules").select("*").limit(1).execute()
            if result.data:
                row = result.data[0]
                return {
                    "spammer": row.get("spammer", []),
                    "always": row.get("always", []),
                    "never": row.get("never", []),
                }
        except Exception as e:
            print(f"Supabase rules fetch error: {e}")

    # Local file fallback
    rules_file = "rules.json"
    if os.path.exists(rules_file):
        with open(rules_file, "r") as f:
            try:
                return json.load(f)
            except Exception:
                pass
    return {"spammer": [], "always": [], "never": []}

@router.post("/rules")
async def save_rules(req: RulesRequest):
    data = {"spammer": req.spammer, "always": req.always, "never": req.never}

    supabase = _get_supabase()
    if supabase:
        try:
            # Single-row rules table: upsert by a fixed id
            supabase.table("gmail_rules").upsert({"id": 1, **data}).execute()
            return {"status": "success"}
        except Exception as e:
            print(f"Supabase rules save error: {e}")

    # Local file fallback
    rules_file = "rules.json"
    with open(rules_file, "w") as f:
        json.dump(data, f, indent=2)
    return {"status": "success"}

# ── Internal helper ───────────────────────────────────────────────────────────
def _get_active_credentials():
    """Return (email, Credentials) for the first connected account, or (None, None)."""
    supabase = _get_supabase()
    if supabase:
        try:
            result = supabase.table("gmail_tokens").select("email").limit(1).execute()
            if result.data:
                email = result.data[0]["email"]
                creds = get_credentials(email)
                return email, creds
        except Exception as e:
            print(f"Supabase credential lookup error: {e}")

    if os.path.exists(TOKENS_FILE):
        with open(TOKENS_FILE, "r") as f:
            try:
                data = json.load(f)
                if data:
                    email = list(data.keys())[-1]
                    return email, get_credentials(email)
            except json.JSONDecodeError:
                pass

    return None, None
