import os
import requests
import pandas as pd
import json
import math
from fastapi import FastAPI, Query
from dotenv import load_dotenv
from backend.utils import score_ip   # geolocate_ip not used for AbuseIPDB
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()
CLOUDFLARE_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN")

# Project root
BASE_DIR = os.path.dirname(os.path.dirname(__file__))

# Country coordinates
COUNTRY_COORDS_FILE = os.path.join(BASE_DIR, "frontend", "src", "data", "countryCoords.json")
with open(COUNTRY_COORDS_FILE, encoding="utf-8-sig") as f:
    countryCoords = json.load(f)

app = FastAPI(title="DOS Attack Visualization API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def safe_float(v):
    try:
        f = float(v)
    except Exception:
        return None
    return f if math.isfinite(f) else None

# ---------------------------
#  CLOUDFLARE FETCH
# ---------------------------
def fetch_cloudflare_attacks(limit=50, date_range="1d"):
    if not CLOUDFLARE_TOKEN:
        return []

    url = (
        f"https://api.cloudflare.com/client/v4/radar/attacks/layer7/top/attacks"
        f"?limit={limit}&dateRange={date_range}"
    )
    headers = {"Authorization": f"Bearer {CLOUDFLARE_TOKEN}"}

    try:
        print(f"Fetching Cloudflare attacks with date_range={date_range}, limit={limit}")
        resp = requests.get(url, headers=headers, timeout=5)
        resp.raise_for_status()
        result = resp.json().get("result", {}).get("top_0", [])
        print(f"Cloudflare returned {len(result)} attacks")
        return result
    except Exception as e:
        print("Cloudflare API error:", e)
        return []

# ---------------------------
#  ABUSEIPDB LOADER (HASHED)
# ---------------------------
def load_abuseipdb_dataset(path=None):
    if path is None:
        path = os.path.join(BASE_DIR, "data", "merged_ips.csv")

    if not os.path.exists(path):
        return pd.DataFrame(columns=["ipHash", "abuseConfidenceScore", "countryCode"])

    try:
        return pd.read_csv(path, dtype=str)
    except Exception as e:
        print("Failed to read merged_ips.csv:", e)
        return pd.DataFrame(columns=["ipHash", "abuseConfidenceScore", "countryCode"])

# ---------------------------
#  COMBINED ENDPOINT
# ---------------------------
@app.get("/combined")
def combined(date_range: str = Query("1d")):
    # -------------------------
    # Process Cloudflare attacks
    # -------------------------
    cf_raw = fetch_cloudflare_attacks(limit=50, date_range=date_range)
    cf_out = []

    for a in cf_raw:
        o_lat, o_lng = None, None
        t_lat, t_lng = None, None
        origin_country = a.get("originCountryAlpha2")
        target_country = a.get("targetCountryAlpha2")

        if origin_country:
            c = countryCoords.get(origin_country)
            if c:
                o_lat, o_lng = c["lat"], c["lon"]

        if target_country:
            c = countryCoords.get(target_country)
            if c:
                t_lat, t_lng = c["lat"], c["lon"]

        if None in (o_lat, o_lng, t_lat, t_lng):
            continue

        cf_out.append({
            "originCountryAlpha2": origin_country,
            "targetCountryAlpha2": target_country,
            "originLat": safe_float(o_lat),
            "originLng": safe_float(o_lng),
            "targetLat": safe_float(t_lat),
            "targetLng": safe_float(t_lng),
            "value": safe_float(a.get("value", 1)) or 1.0
        })

    # -------------------------
    # Process AbuseIPDB (HASHED ONLY)
    # -------------------------
    df = load_abuseipdb_dataset()
    abuse_out = []

    if not df.empty:
        df_sample = df.sample(n=min(100, len(df)))

        for _, r in df_sample.iterrows():
            ipId = r.get("ipHash")  # Use ipHash from CSV
            abuse = safe_float(r.get("abuseConfidenceScore") or 0)
            cc = r.get("countryCode") or "UNK"

            # country-level coordinates (anonymized)
            coords = countryCoords.get(cc)
            latlon = [coords["lat"], coords["lon"]] if coords else None

            # ML score
            try:
                dos_score = score_ip(None, int(abuse or 0), cc)
            except Exception:
                dos_score = None

            abuse_out.append({
                "ipId": ipId,
                "abuseConfidenceScore": abuse,
                "countryCode": cc,
                "latlon": latlon,
                "dos_score": int(dos_score) if dos_score is not None else None
            })

    return {"cloudflare": cf_out, "abuseipdb": abuse_out}

# ---------------------------
# Optional health check
# ---------------------------
@app.get("/")
def root():
    return {"status": "ok", "msg": "API running"}
