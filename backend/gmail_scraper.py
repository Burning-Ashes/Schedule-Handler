import os
import time
import json
import base64
import threading
import requests
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gmail_scraper")

TOKENS_FILE = "tokens.json"
PROCESS_URL = "http://localhost:8000/process-email"
# Track processed IDs in memory (could also use a file or DB for persistent deduplication)
# Since the backend upserts anyway, this is just an optimization.
PROCESSED_EMAILS = set()

# A flag or dict to control thread execution per user email
ACTIVE_THREADS = {}

def get_credentials(user_email: str):
    if not os.path.exists(TOKENS_FILE):
        return None
    with open(TOKENS_FILE, "r") as f:
        data = json.load(f)
    
    user_data = data.get(user_email)
    if not user_data:
        return None
    
    return Credentials(
        token=user_data.get("access_token"),
        refresh_token=user_data.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get("GOOGLE_CLIENT_ID"),
        client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
        scopes=["https://www.googleapis.com/auth/gmail.readonly"]
    )

def update_tokens_file(user_email: str, access_token: str, last_checked: int):
    # Update local json
    if not os.path.exists(TOKENS_FILE):
        data = {}
    else:
        with open(TOKENS_FILE, "r") as f:
            data = json.load(f)
            
    if user_email in data:
        data[user_email]["access_token"] = access_token
        # Update last checked if provided
        if last_checked:
            data[user_email]["last_checked"] = last_checked
        
        with open(TOKENS_FILE, "w") as f:
            json.dump(data, f, indent=2)

def extract_body(payload):
    """Recursively extract plaintext body from payload parts."""
    if payload.get("mimeType") == "text/plain" and 'data' in payload.get("body", {}):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8")
        
    parts = payload.get("parts", [])
    for part in parts:
        body = extract_body(part)
        if body:
            return body
            
    return ""

def poll_gmail(user_email: str):
    logger.info(f"Started polling Gmail for {user_email}")
    while ACTIVE_THREADS.get(user_email, False):
        try:
            creds = get_credentials(user_email)
            if not creds:
                logger.warning(f"No credentials found for {user_email}. Stopping scraper.")
                ACTIVE_THREADS[user_email] = False
                break
            
            # Reconstruct last checked timestamp logic
            with open(TOKENS_FILE, "r") as f:
                data = json.load(f)
            last_checked = data.get(user_email, {}).get("last_checked", int(time.time()) - 86400) # Default to past 24 hrs
            
            service = build("gmail", "v1", credentials=creds)
            query = f"after:{last_checked}"
            
            results = service.users().messages().list(userId="me", q=query).execute()
            messages = results.get("messages", [])
            
            latest_time = last_checked
            
            for msg in messages:
                if not ACTIVE_THREADS.get(user_email, False):
                    break
                    
                email_id = msg["id"]
                if email_id in PROCESSED_EMAILS:
                    continue
                    
                full_msg = service.users().messages().get(userId="me", id=email_id, format="full").execute()
                
                # Update timestamp based on internalDate (which is ms, so div by 1000)
                internal_date = int(full_msg.get("internalDate", "0")) // 1000
                if internal_date > latest_time:
                    latest_time = internal_date
                    
                headers = full_msg.get("payload", {}).get("headers", [])
                subject = next((h["value"] for h in headers if h["name"].lower() == "subject"), "No Subject")
                
                body = extract_body(full_msg.get("payload", {}))
                # Clean/Truncate to 2000 chars to avoid prompt bloat
                body = body[:2000]
                
                # Dispatch to FastAPI
                post_data = {
                    "subject": subject,
                    "body": body,
                    "email_id": email_id
                }
                
                try:
                    resp = requests.post(PROCESS_URL, json=post_data, timeout=30)
                    resp.raise_for_status()
                    logger.info(f"Processed email {email_id} successfully.")
                    PROCESSED_EMAILS.add(email_id)
                except Exception as e:
                    logger.error(f"Failed to post email {email_id} to backend: {e}")
            
            # Update token and last checked time
            if creds.token != data[user_email]["access_token"] or latest_time > last_checked:
                update_tokens_file(user_email, creds.token, latest_time)
                
        except Exception as e:
            logger.error(f"Error in polling loop for {user_email}: {e}")
            
        # Wait 2 minutes before next poll, checking for stop condition every 5s
        for _ in range(24):
            if not ACTIVE_THREADS.get(user_email, False):
                break
            time.sleep(5)

def start_gmail_polling(user_email: str):
    if ACTIVE_THREADS.get(user_email, False):
        logger.info(f"Polling already active for {user_email}")
        return
        
    ACTIVE_THREADS[user_email] = True
    t = threading.Thread(target=poll_gmail, args=(user_email,), daemon=True)
    t.start()

def stop_gmail_polling(user_email: str):
    ACTIVE_THREADS[user_email] = False
