import os
import httpx
from .schemas import JobListing


ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs"


async def search_jobs(
    query: str,
    location: str = "us",
    page: int = 1,
    results_per_page: int = 10,
) -> tuple[list[JobListing], int]:
    """
    Search Adzuna for jobs matching query + location.
    Returns (list of JobListing, total_count).
    """
    app_id = os.getenv("ADZUNA_APP_ID")
    app_key = os.getenv("ADZUNA_APP_KEY")

    # Adzuna uses country codes: us, gb, au, ca, de, fr, in, nl, nz, pl, ru, sg, za
    country = location.lower().strip() if location.lower().strip() in [
        "us", "gb", "au", "ca", "de", "fr", "in", "nl", "nz", "pl", "sg", "za"
    ] else "us"

    url = f"{ADZUNA_BASE}/{country}/search/{page}"

    params = {
        "app_id": app_id,
        "app_key": app_key,
        "what": query,
        "results_per_page": results_per_page,
        "content-type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    jobs = []
    for item in data.get("results", []):
        jobs.append(JobListing(
            id=str(item.get("id", "")),
            title=item.get("title", "Unknown title"),
            company=item.get("company", {}).get("display_name", "Unknown company"),
            location=item.get("location", {}).get("display_name", "Unknown location"),
            salary_min=item.get("salary_min"),
            salary_max=item.get("salary_max"),
            description=item.get("description", "")[:1000],  # cap at 1000 chars
            url=item.get("redirect_url", ""),
            created=item.get("created", ""),
        ))

    return jobs, data.get("count", 0)