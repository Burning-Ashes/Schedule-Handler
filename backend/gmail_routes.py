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
from gmail_scraper import start_gmail_polling, stop_gmail_polling, TOKENS_FILE, get_credentials, fetch_and_process_emails

router = APIRouter(prefix="/auth/gmail")

class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str

class RulesRequest(BaseModel):
    spammer: list[str] = []
    always: list[str] = []
    never: list[str] = []

CLIENT_SECRETS = {
    "web": {
        "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
        "project_id": "zen-scheduler",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
        "redirect_uris": ["http://localhost:8000/auth/gmail/callback"]
    }
}

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/gmail.send" # Need send scope to reply to emails
]

AUTH_FLOWS = {}

def _get_flow():
    if not os.environ.get("GOOGLE_CLIENT_ID") or not os.environ.get("GOOGLE_CLIENT_SECRET"):
        raise HTTPException(status_code=500, detail="Missing Google OAuth credentials in .env")
        
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        CLIENT_SECRETS,
        scopes=SCOPES
    )
    flow.redirect_uri = "http://localhost:8000/auth/gmail/callback"
    return flow

@router.get("")
async def auth_gmail():
    flow = _get_flow()
    # offline access to get refresh_token
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent"
    )
    AUTH_FLOWS[state] = flow
    return RedirectResponse(authorization_url)

@router.get("/callback")
async def auth_gmail_callback(request: Request):
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing authorization code or state")
        
    flow = AUTH_FLOWS.get(state)
    if not flow:
        raise HTTPException(status_code=400, detail="Authentication session expired or invalid. Please try connecting again via /auth/gmail.")
        
    flow.fetch_token(code=code)
    AUTH_FLOWS.pop(state, None)
    credentials = flow.credentials
    
    # Fetch actual user profile email using googleapiclient for robustness
    try:
        oauth2_client = build('oauth2', 'v2', credentials=credentials)
        user_info = oauth2_client.userinfo().get().execute()
        user_email = user_info.get("email", "default_user@gmail.com")
    except Exception as e:
        print(f"Error fetching user email: {e}")
        user_email = "default_user@gmail.com"
    
    # Save tokens
    if os.path.exists(TOKENS_FILE):
        with open(TOKENS_FILE, "r") as f:
            data = json.load(f)
    else:
        data = {}
        
    data[user_email] = {
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "last_checked": int(time.time())
    }
    
    with open(TOKENS_FILE, "w") as f:
        json.dump(data, f, indent=2)
        
    # Start polling
    start_gmail_polling(user_email)
    
    # Redirect back to the frontend
    return RedirectResponse("http://localhost:8080/?connected=true")

@router.get("/status")
async def auth_gmail_status():
    if os.path.exists(TOKENS_FILE):
        with open(TOKENS_FILE, "r") as f:
            try:
                data = json.load(f)
                if data:
                    user_email = list(data.keys())[-1]
                    return {"connected": True, "email": user_email}
            except json.JSONDecodeError:
                pass
    return {"connected": False, "email": None}

@router.post("/disconnect")
async def auth_gmail_disconnect():
    if os.path.exists(TOKENS_FILE):
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
    if not os.path.exists(TOKENS_FILE):
        raise HTTPException(status_code=400, detail="No Gmail account connected.")
    with open(TOKENS_FILE, "r") as f:
        data = json.load(f)
    if not data:
        raise HTTPException(status_code=400, detail="No Gmail account connected.")
    user_email = list(data.keys())[-1]
    
    creds = get_credentials(user_email)
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
    if not os.path.exists(TOKENS_FILE):
        return {"status": "success", "emails_processed": 0}
    with open(TOKENS_FILE, "r") as f:
        data = json.load(f)
    if not data:
        return {"status": "success", "emails_processed": 0}
        
    user_email = list(data.keys())[-1]
    
    try:
        count = fetch_and_process_emails(user_email, manual_run=True)
        return {"status": "success", "emails_processed": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/rules")
async def get_rules():
    rules_file = "rules.json"
    if os.path.exists(rules_file):
        with open(rules_file, "r") as f:
            try:
                return json.load(f)
            except:
                pass
    return {"spammer": [], "always": [], "never": []}

@router.post("/rules")
async def save_rules(req: RulesRequest):
    rules_file = "rules.json"
    data = {"spammer": req.spammer, "always": req.always, "never": req.never}
    with open(rules_file, "w") as f:
        json.dump(data, f, indent=2)
    return {"status": "success"}
