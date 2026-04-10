# Zen Scheduler

**Zen Scheduler (The Digital Curator)** is an AI-powered task orchestration system designed for deep work and zero distractions. 

The system intercepts incoming requests (like emails), uses an LLM to accurately classify them into task categories and urgency levels, and serves them automatically in a pristine, "zen mode" React dashboard.

## 🚀 Features

* **LLM Engine:** Automatically processes incoming messages/data using `llama-3.1-8b-instant` via the Groq API.
* **Intelligent Routing:** Sorts requests automatically into "Human Tasks" (complex tasks requiring manual work), "Automation Review" (routine tasks handled by scripts), and "Spam" (noise that gets isolated).
* **Deep Work UI:** A visually stunning React frontend featuring progress visualization (Potion Bottle tracker), isolated workspaces, and a focus modal for undivided attention.
* **Instant Persistence:** Seamlessly syncs with Supabase to provide real-time status updates (pending vs completed).
* **Vercel-Ready:** Pre-configured `vercel.json` to deploy the FastAPI backend serverlessly out of the box.

## 🛠️ Technology Stack

**Frontend:**
* React + Vite
* TypeScript
* TailwindCSS & shadcn/ui components
* Tanstack React Query (for data fetching and mutations)

**Backend:**
* Python + FastAPI
* Groq SDK (Llama 3 inference engine)
* Supabase (PostgreSQL + Auth)
* Uvicorn (ASGI server)

## 💻 Local Development Setup

To run this application locally, you need to spin up both the FastAPI backend and the Vite frontend simultaneously.

### 1. Database Setup
Ensure you have a Supabase project created. You'll need an API key and the URL to link the backend.
Your Supabase instance should have a `tasks` table with the following schema:
- `id` (uuid)
- `title` (text)
- `description` (text)
- `type` (text - human | automation | spam)
- `urgency_score` (int 1-10)
- `time_estimate_mins` (int)
- `draft_reply` (text)
- `email_id` (text - for deduplication)
- `status` (text - pending | completed)
- `updated_at` (timestamp)

### 2. Backend Setup
Navigate into the backend directory and run the FastAPI server:

```bash
# Move to backend (if your code is structured this way or root depending on your tree)
# For the serverless setup, you might run this from the root directory:
pip install -r requirements.txt

# Create an environment file at backend/.env (or root based on your structure)
# Add your environment variables:
# GROQ_API_KEY=your_key_here
# SUPABASE_URL=your_url_here
# SUPABASE_KEY=your_apikey_here

# Run the backend locally
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```
*(Note: If you run `uvicorn main:app` from the `backend/` directory, adjust the module path accordingly)*

### 3. Frontend Setup
In a separate terminal, install the UI dependencies and start the Vite dev server:

```bash
npm install
npm run dev
```
The client dashboard will be available at `http://localhost:8080/`.

## 📦 Deployment

The repository is configured to easily deploy the backend to Vercel via the included `vercel.json` file. The frontend can also be deployed to Vercel as a standard Vite/React project.
