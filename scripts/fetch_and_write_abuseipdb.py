#!/usr/bin/env python3
# scripts/fetch_and_write_abuseipdb.py

import os
import csv
import requests
import hmac
import hashlib
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("ABUSEIPDB_API_KEY")
HMAC_KEY = os.getenv("IP_HMAC_KEY")  # required for anonymization

OUT_PATH = os.path.join("data", "merged_ips.csv")

if not API_KEY:
    raise SystemExit("ABUSEIPDB_API_KEY not found in .env — set it and re-run.")

if not HMAC_KEY:
    raise SystemExit("IP_HMAC_KEY not found in .env — set it and re-run.")

headers = {"Key": API_KEY, "Accept": "application/json"}
HMAC_KEY = HMAC_KEY.encode("utf-8")

def ip_hash(ip: str) -> str:
    """Return HMAC-SHA256 hash of IP."""
    return hmac.new(HMAC_KEY, ip.encode("utf-8"), hashlib.sha256).hexdigest()

def fetch_blacklist(limit=1000):
    """Fetch from AbuseIPDB blacklist API."""
    url = "https://api.abuseipdb.com/api/v2/blacklist"
    params = {"limit": limit}
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=20)
        if resp.status_code != 200:
            print(f"Blacklist fetch failed: HTTP {resp.status_code} {resp.text}")
            return []

        data = resp.json().get("data", [])
        rows = []

        for item in data:
            ip = item.get("ipAddress") or item.get("ip")
            score = item.get("abuseConfidenceScore") or item.get("abuseConfidence")
            country = item.get("countryCode") or item.get("country")

            if not ip:
                continue

            rows.append({
                "ipHash": ip_hash(ip),                      # anonymized - NO raw IP stored
                "abuseConfidenceScore": score or 0,
                "countryCode": country or "UNK"
            })

        print(f"Fetched {len(rows)} blacklist entries (anonymized).")
        return rows

    except Exception as e:
        print("Error fetching blacklist:", e)
        return []

def write_rows(rows):
    if not rows:
        print("No rows to write.")
        return

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["ipHash", "abuseConfidenceScore", "countryCode"])
        for r in rows:
            w.writerow([r["ipHash"], r["abuseConfidenceScore"], r["countryCode"]])

    print(f"Wrote {len(rows)} anonymized rows to {OUT_PATH}")

def main():
    rows = fetch_blacklist(limit=1000)
    if rows:
        write_rows(rows)
    else:
        print("No data fetched — check API key permissions or quota.")

if __name__ == "__main__":
    main()
