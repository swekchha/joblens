import json
import os
import re
from openai import OpenAI
from .schemas import MatchAnalysis, UserProfile, JobListing
from .prompts import MATCH_PROMPT

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def _extract_json(text: str) -> dict:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def analyze_match(profile: UserProfile, job: JobListing) -> MatchAnalysis:
    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        max_tokens=600,
        temperature=0.2,
        messages=[
            {"role": "system", "content": MATCH_PROMPT},
            {"role": "user", "content": f"""
Candidate profile:
- Job title they want: {profile.title}
- Skills: {profile.skills}
- Years of experience: {profile.years_experience}
- Education: {profile.education or "Not specified"}
- Extra notes: {profile.notes or "None"}

Job they are considering:
- Title: {job.title}
- Company: {job.company}
- Location: {job.location}
- Description: {job.description}

Analyze the match and return JSON only.
"""}
        ],
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    data = _extract_json(raw)

    score = max(0, min(100, int(data.get("score", 50))))
    verdict = data.get("verdict", "Maybe")
    if verdict not in {"Apply", "Maybe", "Skip"}:
        verdict = "Apply" if score >= 70 else "Maybe" if score >= 40 else "Skip"

    return MatchAnalysis(
        score=score,
        verdict=verdict,
        verdict_reason=data.get("verdict_reason", ""),
        you_have=data.get("you_have", [])[:3],
        you_lack=data.get("you_lack", [])[:3],
        transferable=data.get("transferable", [])[:2],
    )