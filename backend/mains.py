import os
import requests
import pandas as pd
import json
from fastapi import FastAPI, Query
from dotenv import load_dotenv
from backend.utils import geolocate_ip, score_ip
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()
CLOUDFLARE_TOKEN = os.getenv("CLOUDFLARE_RADAR_TOKEN")
ABUSEIPDB_TOKEN = os.getenv("ABUSEIPDB_API_KEY")

# Project root (so paths work everywhere)
BASE_DIR = os.path.dirname(os.path.dirname(__file__))

# country coordinates fallback
COUNTRY_COORDS_FILE = os.path.join(BASE_DIR, "frontend", "src", "data", "countryCoords.json")
with open(COUNTRY_COORDS_FILE, encoding="utf-8") as f:
    countryCoords = json.load(f)

app = FastAPI(title="DOS Attack Visualization API")

#  CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cloudflare fetch
def fetch_cloudflare_attacks(limit=50, date_range="1d"):
    url = f"https://api.cloudflare.com/client/v4/radar/attacks/layer7/top/attacks?limit={limit}&dateRange={date_range}"
    headers = {"Authorization": f"Bearer {CLOUDFLARE_TOKEN}"}
    try:
        resp = requests.get(url, headers=headers, timeout=5)
        resp.raise_for_status()
        return resp.json().get("result", {}).get("top_0", [])
    except requests.RequestException as e:
        print(f"Cloudflare API error: {e}")
        return []

# AbuseIPDB 
def load_abuseipdb_dataset(path=None):
    if path is None:
        path = os.path.join(BASE_DIR, "data", "merged_ips.csv")
    if os.path.exists(path):
        return pd.read_csv(path)
    print(f"AbuseIPDB dataset not found at {path}")
    return pd.DataFrame(columns=["ipAddress", "abuseConfidenceScore", "countryCode", "label"])

# Combined endpoint 
@app.get("/combined")
def combined(days: int = Query(5, ge=1)):
    # Cloudflare attacks
    cf_attacks = fetch_cloudflare_attacks(limit=50, date_range=f"{days}d")
    cf_attacks_processed = []

    for attack in cf_attacks:
        origin_coords = None
        target_coords = None

        if attack.get("originIP"):
            origin_coords = geolocate_ip(attack["originIP"])
        if attack.get("targetIP"):
            target_coords = geolocate_ip(attack["targetIP"])

        if not origin_coords and attack.get("originCountryAlpha2"):
            c = countryCoords.get(attack["originCountryAlpha2"])
            if c:
                origin_coords = [c["lat"], c["lon"]]
        if not target_coords and attack.get("targetCountryAlpha2"):
            c = countryCoords.get(attack["targetCountryAlpha2"])
            if c:
                target_coords = [c["lat"], c["lon"]]

        if origin_coords and target_coords:
            cf_attacks_processed.append({
                "originLat": origin_coords[0],
                "originLng": origin_coords[1],
                "targetLat": target_coords[0],
                "targetLng": target_coords[1],
                "value": attack.get("value", 1)
            })

    # AbuseIPDB points
    df = load_abuseipdb_dataset()
    abuse_results = []

    if not df.empty:
        df_sample = df.sample(n=min(100, len(df)))
        for _, row in df_sample.iterrows():
            try:
                latlon = geolocate_ip(row["ipAddress"])
            except Exception:
                latlon = None

            dos_score = score_ip(
                row["ipAddress"],
                row["abuseConfidenceScore"],
                row["countryCode"]
            )

            abuse_results.append({
                "ipAddress": row["ipAddress"],
                "abuseConfidenceScore": row["abuseConfidenceScore"],
                "countryCode": row["countryCode"],
                "latlon": latlon,
                "dos_score": dos_score
            })

    return {
        "cloudflare": cf_attacks_processed,
        "abuseipdb": abuse_results
    }
