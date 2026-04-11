import os
import json
import time
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
import google_auth_oauthlib.flow
from gmail_scraper import start_gmail_polling, stop_gmail_polling, TOKENS_FILE

router = APIRouter(prefix="/auth/gmail")

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

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

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
    
    # We should normally detect the user_email from the token info,
    # but we'll use a default hardcoded key "default_user" for this MVP 
    # to support a single user since no other user context is provided.
    user_email = "default_user@gmail.com" 
    
    # Alternatively get profile from people API, but since schema allows simple keys:
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
    
    return {"status": "success", "message": "Gmail connected and polling started."}

@router.post("/disconnect")
async def auth_gmail_disconnect():
    user_email = "default_user@gmail.com"
    stop_gmail_polling(user_email)
    
    if os.path.exists(TOKENS_FILE):
        with open(TOKENS_FILE, "r") as f:
            data = json.load(f)
        if user_email in data:
            del data[user_email]
            
        with open(TOKENS_FILE, "w") as f:
            json.dump(data, f, indent=2)
            
    return {"status": "success", "message": "Gmail disconnected and polling stopped."}
