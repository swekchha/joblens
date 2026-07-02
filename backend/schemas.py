from typing import Optional
from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    title: str                    # e.g. "Software Engineer"
    skills: str                   # e.g. "Python, React, SQL"
    years_experience: int
    education: Optional[str] = "" # e.g. "CS degree"
    notes: Optional[str] = ""     # anything extra


class SearchRequest(BaseModel):
    query: str
    location: str = "us"
    profile: UserProfile


class JobListing(BaseModel):
    id: str
    title: str
    company: str
    location: str
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    description: str
    url: str
    created: str


class MatchAnalysis(BaseModel):
    score: int                    # 0-100
    verdict: str                  # "Apply", "Maybe", "Skip"
    verdict_reason: str           # one sentence why
    you_have: list[str]           # what matches
    you_lack: list[str]           # what's missing
    transferable: list[str]       # what bridges the gap


class JobResult(BaseModel):
    job: JobListing
    analysis: MatchAnalysis


class SearchResponse(BaseModel):
    results: list[JobResult]
    total: int
    query: str
    location: str