import asyncio
import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv(Path(__file__).parent / ".env")  # also check backend/.env
from .jobs import search_jobs
from .analyzer import analyze_match
from .schemas import SearchRequest, SearchResponse, JobResult, MatchAnalysis
from .database import init_db, save_search, save_job, get_saved_jobs, delete_saved_job, get_recent_searches

app = FastAPI(
    title="JobLens API",
    description="Job search with honest AI match analysis.",
    version="1.0.0",
)

# Initialize database on startup
init_db()

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "ok", "service": "JobLens API", "version": "1.0.0"}


@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="query cannot be empty")

    try:
        jobs, total = await search_jobs(
            query=request.query,
            location=request.location,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Job search failed: {str(e)}")

    if not jobs:
        return SearchResponse(
            results=[],
            total=0,
            query=request.query,
            location=request.location,
        )

    loop = asyncio.get_event_loop()

    async def analyze_one(job):
        try:
            analysis = await loop.run_in_executor(
                None, analyze_match, request.profile, job
            )
            return JobResult(job=job, analysis=analysis)
        except Exception:
            return JobResult(
                job=job,
                analysis=MatchAnalysis(
                    score=50,
                    verdict="Maybe",
                    verdict_reason="Could not analyze this job automatically.",
                    you_have=[],
                    you_lack=[],
                    transferable=[],
                )
            )

    results = await asyncio.gather(*[analyze_one(job) for job in jobs])
    results = sorted(results, key=lambda r: r.analysis.score, reverse=True)

    # Save search to database
    save_search(
        query=request.query,
        location=request.location,
        profile_title=request.profile.title,
        profile_skills=request.profile.skills,
        result_count=len(results),
    )

    return SearchResponse(
        results=list(results),
        total=total,
        query=request.query,
        location=request.location,
    )


# ── Saved Jobs endpoints ───────────────────────────────────────────────────

class SaveJobRequest(BaseModel):
    job_id: str
    job_title: str
    company: str
    location: str
    url: str
    salary_min: float = None
    salary_max: float = None
    score: int
    verdict: str
    verdict_reason: str = ""


@app.post("/saved-jobs")
def save_job_endpoint(request: SaveJobRequest):
    saved = save_job(
        job_id=request.job_id,
        title=request.job_title,
        company=request.company,
        location=request.location,
        url=request.url,
        salary_min=request.salary_min,
        salary_max=request.salary_max,
        score=request.score,
        verdict=request.verdict,
        verdict_reason=request.verdict_reason,
    )
    if not saved:
        raise HTTPException(status_code=409, detail="Job already saved")
    return {"message": "Job saved successfully"}


@app.get("/saved-jobs")
def list_saved_jobs():
    return {"saved_jobs": get_saved_jobs()}


@app.delete("/saved-jobs/{job_id}")
def remove_saved_job(job_id: str):
    delete_saved_job(job_id)
    return {"message": "Job removed"}


@app.get("/recent-searches")
def list_recent_searches():
    return {"searches": get_recent_searches()}