# JobLens

AI-powered job search that scores every listing against your profile before you apply — so you spend time on jobs where you actually have a shot.

Most job sites show you hundreds of listings. JobLens shows you 10 and tells you exactly which ones to apply to, what you're missing, and what transfers from your background.

**Live demo:** https://joblens-seven-chi.vercel.app

---

## The Problem

Job searching is a black box. You apply, hear nothing, and never know if you were even close. JobLens fixes that by scoring every job against your profile before you waste time on an application.

---

## What It Does

- Search any job title across 8 countries via Adzuna API
- AI scores each result 0–100 based on your profile
- Verdict per job: **Apply**, **Maybe**, or **Skip**
- Breakdown of what you have, what you're missing, and what's transferable
- Save jobs to review later — sorted by match verdict
- Dark mode toggle
- Profile persists in localStorage so you never re-enter it

---

## Screenshots

### Saved jobs sorted by verdict
<img width="1070" height="900" alt="Saved jobs" src="https://github.com/user-attachments/assets/ec95e92c-d03c-4eb3-8c54-a26c2b36f4a2" />

### Results with AI match analysis
<img width="1072" height="901" alt="Job results with analysis" src="https://github.com/user-attachments/assets/823631a5-24be-4737-85ad-dcf55eb413bd" />

### Searching and scoring in real time
<img width="1115" height="859" alt="Loading screen" src="https://github.com/user-attachments/assets/191317cf-33b2-4ddb-91e3-c0870020504d" />



---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI |
| AI | OpenAI GPT-4o-mini |
| Job Data | Adzuna API |
| Database | SQLite (search history, saved jobs) |
| Testing | pytest (7 tests) |
| Deployment | Vercel (frontend) + Render (backend) |

---

## Key Engineering

- **Parallel AI analysis** — all 10 jobs scored simultaneously with `asyncio.gather`, cutting wait time by ~10x vs sequential
- **External API integration** — Adzuna job search API across 8 country markets
- **SQLite persistence** — saved jobs and search history survive page refreshes
- **Configurable CORS** — allowed origins via environment variable
- **7 backend tests** — covers all endpoints including duplicate detection and error cases

---

## Running Locally

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate       # Windows
source .venv/bin/activate    # Mac/Linux
pip install -r requirements.txt
cp .env.example .env         # add your keys
uvicorn backend.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

### Tests
```bash
pytest backend/tests/ -v
```

---

## Environment Variables

```
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4o-mini
ADZUNA_APP_ID=your-adzuna-id
ADZUNA_APP_KEY=your-adzuna-key
ALLOWED_ORIGINS=https://your-frontend-url.vercel.app
```
