import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_search_empty_query():
    response = client.post("/search", json={
        "query": "",
        "location": "us",
        "profile": {
            "title": "Software Engineer",
            "skills": "Python, React",
            "years_experience": 2
        }
    })
    assert response.status_code == 400


def test_get_saved_jobs_empty():
    response = client.get("/saved-jobs")
    assert response.status_code == 200
    assert "saved_jobs" in response.json()


def test_save_job():
    response = client.post("/saved-jobs", json={
        "job_id": "test-123",
        "job_title": "Software Engineer",
        "company": "Test Corp",
        "location": "Remote",
        "url": "https://example.com",
        "score": 85,
        "verdict": "Apply",
        "verdict_reason": "Great match"
    })
    assert response.status_code == 200


def test_save_duplicate_job():
    # Save it once
    client.post("/saved-jobs", json={
        "job_id": "dupe-456",
        "job_title": "Engineer",
        "company": "Corp",
        "location": "Remote",
        "url": "https://example.com",
        "score": 70,
        "verdict": "Apply",
        "verdict_reason": "Good match"
    })
    # Save again — should get 409
    response = client.post("/saved-jobs", json={
        "job_id": "dupe-456",
        "job_title": "Engineer",
        "company": "Corp",
        "location": "Remote",
        "url": "https://example.com",
        "score": 70,
        "verdict": "Apply",
        "verdict_reason": "Good match"
    })
    assert response.status_code == 409


def test_delete_saved_job():
    response = client.delete("/saved-jobs/test-123")
    assert response.status_code == 200


def test_recent_searches():
    response = client.get("/recent-searches")
    assert response.status_code == 200
    assert "searches" in response.json()