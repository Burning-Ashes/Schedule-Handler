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

def fetch_and_process_emails(user_email: str, manual_run: bool = False) -> int:
    try:
        creds = get_credentials(user_email)
        if not creds:
            logger.warning(f"No credentials found for {user_email}. Stopping scraper.")
            if not manual_run:
                ACTIVE_THREADS[user_email] = False
            return 0
        
        with open(TOKENS_FILE, "r") as f:
            data = json.load(f)
        last_checked = data.get(user_email, {}).get("last_checked", int(time.time()) - 86400)
        
        service = build("gmail", "v1", credentials=creds)
        query = f"after:{last_checked}"
        
        results = service.users().messages().list(userId="me", q=query).execute()
        messages = results.get("messages", [])
        
        latest_time = last_checked
        emails_processed = 0
        
        rules_file = "rules.json"
        rules = {"spammer": [], "always": [], "never": []}
        if os.path.exists(rules_file):
            try:
                with open(rules_file, "r") as rf:
                    rules_data = json.load(rf)
                    rules["spammer"] = rules_data.get("spammer", [])
                    rules["always"] = rules_data.get("always", [])
                    rules["never"] = rules_data.get("never", [])
            except:
                pass

        from supabase import create_client
        if os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_KEY"):
             supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
        else:
             supabase = None

        for msg in messages:
            if not manual_run and not ACTIVE_THREADS.get(user_email, False):
                break
                
            email_id = msg["id"]
            if email_id in PROCESSED_EMAILS:
                continue
                
            full_msg = service.users().messages().get(userId="me", id=email_id, format="full").execute()
            
            internal_date = int(full_msg.get("internalDate", "0")) // 1000
            if internal_date > latest_time:
                latest_time = internal_date
                
            headers = full_msg.get("payload", {}).get("headers", [])
            subject = next((h["value"] for h in headers if h["name"].lower() == "subject"), "No Subject")
            sender = next((h["value"] for h in headers if h["name"].lower() == "from"), "Unknown")
            
            is_spam = any(r.lower() in sender.lower() for r in rules["spammer"])
            is_always = any(r.lower() in sender.lower() for r in rules["always"])
            is_never = any(r.lower() in sender.lower() for r in rules["never"])

            if is_spam:
                logger.info(f"Skipping spammer: {sender}")
                PROCESSED_EMAILS.add(email_id)
                emails_processed += 1
                continue

            body = extract_body(full_msg.get("payload", {}))
            body = body[:2000]

            if is_never and supabase:
                logger.info(f"Applying NEVER automate rule to email: {subject}")
                dummy_task = {
                    "title": f"Review email from {sender[:25]}",
                    "description": f"Subject: {subject}",
                    "type": "human",
                    "urgency_score": 5,
                    "time_estimate_mins": 10,
                    "draft_reply": "",
                    "email_id": email_id,
                    "status": "pending"
                }
                try:
                    supabase.table("tasks").upsert(dummy_task, on_conflict="email_id").execute()
                    PROCESSED_EMAILS.add(email_id)
                    emails_processed += 1
                except Exception as e:
                    logger.error(f"Failed to insert NEVER automate task: {e}")
                continue
                
            post_data = {
                "subject": subject,
                "body": body,
                "email_id": email_id
            }
            
            try:
                resp = requests.post(PROCESS_URL, json=post_data, timeout=30)
                resp.raise_for_status()
                
                if is_always:
                    try:
                        task_res = resp.json().get("task", {})
                        if task_res.get("time_estimate_mins") == 10:
                            draft = task_res.get("draft_reply")
                            if draft:
                                from email.message import EmailMessage
                                import base64
                                reply_msg = EmailMessage()
                                reply_msg.set_content(draft)
                                reply_msg["To"] = sender
                                reply_msg["Subject"] = f"Re: {subject}"
                                
                                encoded = base64.urlsafe_b64encode(reply_msg.as_bytes()).decode()
                                service.users().messages().send(userId="me", body={"raw": encoded}).execute()
                                logger.info(f"Auto-sent reply to {sender}")
                                
                                if supabase:
                                    supabase.table("tasks").update({"status": "completed"}).eq("email_id", email_id).execute()
                    except Exception as ai_e:
                        logger.error(f"Failed to auto-send for ALWAYS rule: {ai_e}")

                logger.info(f"Processed email {email_id} successfully.")
                PROCESSED_EMAILS.add(email_id)
                emails_processed += 1
            except Exception as e:
                logger.error(f"Failed to post email {email_id} to backend: {e}")
        
        if creds.token != data[user_email]["access_token"] or latest_time > last_checked:
            update_tokens_file(user_email, creds.token, latest_time)
            
        return emails_processed
            
    except Exception as e:
        logger.error(f"Error in fetching loop for {user_email}: {e}")
        return 0

def poll_gmail(user_email: str):
    logger.info(f"Started polling Gmail for {user_email}")
    while ACTIVE_THREADS.get(user_email, False):
        fetch_and_process_emails(user_email, manual_run=False)
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
