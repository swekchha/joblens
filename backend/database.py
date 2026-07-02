import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "joblens.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS searches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query TEXT NOT NULL,
            location TEXT NOT NULL,
            profile_title TEXT NOT NULL,
            profile_skills TEXT NOT NULL,
            result_count INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS saved_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT NOT NULL,
            job_title TEXT NOT NULL,
            company TEXT NOT NULL,
            location TEXT NOT NULL,
            url TEXT NOT NULL,
            salary_min REAL,
            salary_max REAL,
            score INTEGER NOT NULL,
            verdict TEXT NOT NULL,
            verdict_reason TEXT,
            created_at TEXT NOT NULL
        );
    """)

    conn.commit()
    conn.close()


def save_search(query: str, location: str, profile_title: str, profile_skills: str, result_count: int):
    conn = get_db()
    conn.execute(
        """INSERT INTO searches (query, location, profile_title, profile_skills, result_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (query, location, profile_title, profile_skills, result_count, datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()


def save_job(job_id, title, company, location, url, salary_min, salary_max, score, verdict, verdict_reason):
    conn = get_db()
    # Don't save duplicates
    existing = conn.execute(
        "SELECT id FROM saved_jobs WHERE job_id = ?", (job_id,)
    ).fetchone()
    if existing:
        conn.close()
        return False
    conn.execute(
        """INSERT INTO saved_jobs
           (job_id, job_title, company, location, url, salary_min, salary_max, score, verdict, verdict_reason, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (job_id, title, company, location, url, salary_min, salary_max,
         score, verdict, verdict_reason, datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()
    return True


def get_saved_jobs():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM saved_jobs ORDER BY score DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_saved_job(job_id: str):
    conn = get_db()
    conn.execute("DELETE FROM saved_jobs WHERE job_id = ?", (job_id,))
    conn.commit()
    conn.close()


def get_recent_searches(limit: int = 5):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM searches ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]