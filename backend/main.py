import os
import json
import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# ── Init ──────────────────────────────────────────────────────────────────────
groq = Groq(api_key=os.environ["GROQ_API_KEY"])

supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"],
)

app = FastAPI(title="Zen-Mode Task Orchestrator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schema ────────────────────────────────────────────────────────────────────
class EmailPayload(BaseModel):
    subject: str
    body: str
    email_id: str | None = None   # optional dedup key for upsert

# ── System Prompt ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """
You are a ruthlessly precise task-classification engine.
Given an email, extract and return ONLY a valid JSON object — no markdown,
no explanation, no code fences.

Classification rules you MUST follow:

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

# ── Helper ────────────────────────────────────────────────────────────────────
def extract_json(text: str) -> dict:
    """Strip markdown fences if Gemini adds them, then parse."""
    cleaned = re.sub(r"```(?:json)?|```", "", text).strip()
    return json.loads(cleaned)

# ── Endpoint ──────────────────────────────────────────────────────────────────
@app.post("/process-email")
async def process_email(payload: EmailPayload):
    # 1. Build user message
    user_message = f"Subject: {payload.subject}\n\nBody:\n{payload.body}"

    # 2. Call Groq
    try:
        response = groq.chat.completions.create(
            model="llama-3.1-8b-instant",
            temperature=0.2,
            max_tokens=512,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
        )
        task_data = extract_json(response.choices[0].message.content)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=502,
            detail=f"Groq returned non-JSON output: {e}",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Groq error: {e}")

    # 3. Attach the source email_id for upsert (dedup)
    if payload.email_id:
        task_data["email_id"] = payload.email_id
        
    task_data["status"] = "pending"

    # 4. Upsert into Supabase
    try:
        result = (
            supabase.table("tasks")
            .upsert(task_data, on_conflict="email_id")   # idempotent
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Supabase error: {e}")

    return {"status": "ok", "task": task_data, "db_response": result.data}


@app.get("/health")
async def health():
    return {"status": "alive"}

@app.get("/tasks")
async def get_tasks():
    try:
        result = (
            supabase.table("tasks")
            .select("*")
            .eq("status", "pending")
            .order("urgency_score", desc=True)
            .order("time_estimate_mins", desc=False)
            .execute()
        )
        return {"tasks": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tasks: {e}")

@app.get("/tasks/completed")
async def get_completed_tasks():
    try:
        result = (
            supabase.table("tasks")
            .select("*")
            .eq("status", "completed")
            .order("updated_at", desc=True)
            .execute()
        )
        return {"tasks": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch completed tasks: {e}")

@app.post("/tasks/{task_id}/complete")
async def complete_task(task_id: str):
    try:
        result = (
            supabase.table("tasks")
            .update({"status": "completed"})
            .eq("id", task_id)
            .execute()
        )
        return {"status": "ok", "task": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to complete task: {e}")

@app.post("/tasks/{task_id}/reopen")
async def reopen_task(task_id: str):
    try:
        result = (
            supabase.table("tasks")
            .update({"status": "pending"})
            .eq("id", task_id)
            .execute()
        )
        return {"status": "ok", "task": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reopen task: {e}")

