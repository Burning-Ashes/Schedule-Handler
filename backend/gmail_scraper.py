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

# Track processed IDs in memory — the Supabase upsert is the real dedup guard.
PROCESSED_EMAILS: set = set()

# Controls background thread execution per user email (local dev only).
ACTIVE_THREADS: dict = {}

def _get_supabase():
    """Return a Supabase client when env vars are present, otherwise None."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        return None
    from supabase import create_client
    return create_client(url, key)

def get_credentials(user_email: str):
    """Load credentials for a user, checking Supabase first then local file."""
    token_data = None

    supabase = _get_supabase()
    if supabase:
        try:
            result = (
                supabase.table("gmail_tokens")
                .select("access_token,refresh_token,last_checked")
                .eq("email", user_email)
                .limit(1)
                .execute()
            )
            if result.data:
                token_data = result.data[0]
        except Exception as e:
            logger.error(f"Supabase token read error: {e}")

    if token_data is None and os.path.exists(TOKENS_FILE):
        with open(TOKENS_FILE, "r") as f:
            try:
                data = json.load(f)
                token_data = data.get(user_email)
            except json.JSONDecodeError:
                pass

    if not token_data:
        return None

    return Credentials(
        token=token_data.get("access_token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get("GOOGLE_CLIENT_ID"),
        client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
        scopes=["https://www.googleapis.com/auth/gmail.readonly"],
    )

def _update_tokens(user_email: str, access_token: str, last_checked: int):
    """Persist a refreshed token back to Supabase or the local file."""
    supabase = _get_supabase()
    if supabase:
        try:
            supabase.table("gmail_tokens").upsert(
                {
                    "email": user_email,
                    "access_token": access_token,
                    "last_checked": last_checked,
                },
                on_conflict="email",
            ).execute()
            return
        except Exception as e:
            logger.error(f"Supabase token update error: {e}")

    # Local file fallback
    data = {}
    if os.path.exists(TOKENS_FILE):
        with open(TOKENS_FILE, "r") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                pass
    if user_email in data:
        data[user_email]["access_token"] = access_token
        if last_checked:
            data[user_email]["last_checked"] = last_checked
        with open(TOKENS_FILE, "w") as f:
            json.dump(data, f, indent=2)

def _get_last_checked(user_email: str) -> int:
    """Return the unix timestamp of the last email check for a user."""
    supabase = _get_supabase()
    if supabase:
        try:
            result = (
                supabase.table("gmail_tokens")
                .select("last_checked")
                .eq("email", user_email)
                .limit(1)
                .execute()
            )
            if result.data:
                return result.data[0].get("last_checked", int(time.time()) - 86400)
        except Exception as e:
            logger.error(f"Supabase last_checked read error: {e}")

    if os.path.exists(TOKENS_FILE):
        with open(TOKENS_FILE, "r") as f:
            try:
                data = json.load(f)
                return data.get(user_email, {}).get("last_checked", int(time.time()) - 86400)
            except json.JSONDecodeError:
                pass

    return int(time.time()) - 86400

def _get_rules() -> dict:
    """Load routing rules from Supabase or local file."""
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
            logger.error(f"Supabase rules read error: {e}")

    rules_file = "rules.json"
    if os.path.exists(rules_file):
        try:
            with open(rules_file, "r") as rf:
                return json.load(rf)
        except Exception:
            pass

    return {"spammer": [], "always": [], "never": []}

def extract_body(payload):
    """Recursively extract plaintext body from a Gmail payload."""
    if payload.get("mimeType") == "text/plain" and "data" in payload.get("body", {}):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8")
    for part in payload.get("parts", []):
        body = extract_body(part)
        if body:
            return body
    return ""

def _process_email_inline(subject: str, body: str, email_id: str) -> dict | None:
    """
    Classify an email using Groq and upsert into Supabase directly —
    no HTTP self-call, which is unreliable in serverless environments.
    """
    try:
        from groq import Groq
        import re

        SYSTEM_PROMPT = """
You are a ruthlessly precise task-classification engine.
Given an email, extract and return ONLY a valid JSON object — no markdown,
no explanation, no code fences.

TYPE
  "human"      → creative, nuanced, or complex work requiring judgment
  "automation" → repetitive, data-entry, or rule-based work a script could do
  "spam"       → unsolicited, promotional, or irrelevant email

URGENCY_SCORE  (integer 1-10)
  8-10  → action required within 5 minutes
  4-7   → action required within a few hours
  1-3   → can wait more than a few hours

TIME_ESTIMATE_MINS  (integer, pick exactly one)
  10   → quick task / short reply
  120  → focused work session
  840  → massive project / deep research

OUTPUT FORMAT — return only this JSON, nothing else:
{
  "title":              "<concise task title, max 12 words>",
  "description":        "<1-2 sentence summary of what needs doing>",
  "type":               "human" | "automation" | "spam",
  "urgency_score":      <1-10>,
  "time_estimate_mins": <10 | 120 | 840>,
  "draft_reply":        "<ready-to-send reply to the email sender>"
}
""".strip()

        groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            temperature=0.2,
            max_tokens=512,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Subject: {subject}\n\nBody:\n{body}"},
            ],
        )
        cleaned = re.sub(r"```(?:json)?|```", "", response.choices[0].message.content).strip()
        task_data = json.loads(cleaned)
        task_data["email_id"] = email_id
        task_data["status"] = "pending"

        supabase = _get_supabase()
        if supabase:
            supabase.table("tasks").upsert(task_data, on_conflict="email_id").execute()

        return task_data
    except Exception as e:
        logger.error(f"Inline email processing failed for {email_id}: {e}")
        return None

def fetch_and_process_emails(user_email: str, manual_run: bool = False) -> int:
    try:
        creds = get_credentials(user_email)
        if not creds:
            logger.warning(f"No credentials found for {user_email}.")
            if not manual_run:
                ACTIVE_THREADS[user_email] = False
            return 0

        last_checked = _get_last_checked(user_email)
        service = build("gmail", "v1", credentials=creds)
        query = f"after:{last_checked}"

        results = service.users().messages().list(userId="me", q=query).execute()
        messages = results.get("messages", [])

        latest_time = last_checked
        emails_processed = 0
        rules = _get_rules()
        supabase = _get_supabase()

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

            body = extract_body(full_msg.get("payload", {}))[:2000]

            if is_never and supabase:
                dummy_task = {
                    "title": f"Review email from {sender[:25]}",
                    "description": f"Subject: {subject}",
                    "type": "human",
                    "urgency_score": 5,
                    "time_estimate_mins": 10,
                    "draft_reply": "",
                    "email_id": email_id,
                    "status": "pending",
                }
                try:
                    supabase.table("tasks").upsert(dummy_task, on_conflict="email_id").execute()
                    PROCESSED_EMAILS.add(email_id)
                    emails_processed += 1
                except Exception as e:
                    logger.error(f"Failed to insert NEVER automate task: {e}")
                continue

            task_data = _process_email_inline(subject, body, email_id)
            if task_data:
                if is_always and task_data.get("time_estimate_mins") == 10:
                    draft = task_data.get("draft_reply")
                    if draft:
                        try:
                            reply_msg = EmailMessage()
                            reply_msg.set_content(draft)
                            reply_msg["To"] = sender
                            reply_msg["Subject"] = f"Re: {subject}"
                            encoded = base64.urlsafe_b64encode(reply_msg.as_bytes()).decode()
                            service.users().messages().send(userId="me", body={"raw": encoded}).execute()
                            logger.info(f"Auto-sent reply to {sender}")
                            if supabase:
                                supabase.table("tasks").update({"status": "completed"}).eq("email_id", email_id).execute()
                        except Exception as e:
                            logger.error(f"Failed to auto-send for ALWAYS rule: {e}")

                PROCESSED_EMAILS.add(email_id)
                emails_processed += 1

        _update_tokens(user_email, creds.token, latest_time)
        return emails_processed

    except Exception as e:
        logger.error(f"Error in fetching loop for {user_email}: {e}")
        return 0

# ── Background polling daemon (local dev only) ────────────────────────────────
def poll_gmail(user_email: str):
    logger.info(f"Started polling Gmail for {user_email}")
    while ACTIVE_THREADS.get(user_email, False):
        fetch_and_process_emails(user_email, manual_run=False)
        for _ in range(24):
            if not ACTIVE_THREADS.get(user_email, False):
                break
            time.sleep(5)

def start_gmail_polling(user_email: str):
    """Start the background polling thread — only safe in non-serverless envs."""
    if ACTIVE_THREADS.get(user_email, False):
        logger.info(f"Polling already active for {user_email}")
        return
    ACTIVE_THREADS[user_email] = True
    t = threading.Thread(target=poll_gmail, args=(user_email,), daemon=True)
    t.start()

def stop_gmail_polling(user_email: str):
    ACTIVE_THREADS[user_email] = False
