# backend/mains.py
import os
import requests
import pandas as pd
import json
import math
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

def safe_float(v):
    """Return a plain float if v is finite, else None."""
    try:
        f = float(v)
    except Exception:
        return None
    if not math.isfinite(f):
        return None
    return f

# Cloudflare fetch
def fetch_cloudflare_attacks(limit=50, date_range="1d"):
    if not CLOUDFLARE_TOKEN:
        return []
    url = f"https://api.cloudflare.com/client/v4/radar/attacks/layer7/top/attacks?limit={limit}&dateRange={date_range}"
    headers = {"Authorization": f"Bearer {CLOUDFLARE_TOKEN}"}
    try:
        resp = requests.get(url, headers=headers, timeout=5)
        resp.raise_for_status()
        return resp.json().get("result", {}).get("top_0", [])
    except requests.RequestException as e:
        print(f"Cloudflare API error: {e}")
        return []

# AbuseIPDB dataset loader
def load_abuseipdb_dataset(path=None):
    if path is None:
        path = os.path.join(BASE_DIR, "data", "merged_ips.csv")
    if os.path.exists(path):
        try:
            return pd.read_csv(path, dtype=str)
        except Exception as e:
            print(f"Failed reading AbuseIPDB dataset {path}: {e}")
            return pd.DataFrame(columns=["ipAddress", "abuseConfidenceScore", "countryCode"])
    print(f"AbuseIPDB dataset not found at {path}")
    return pd.DataFrame(columns=["ipAddress", "abuseConfidenceScore", "countryCode"])

# Combined endpoint
@app.get("/combined")
def combined(days: int = Query(5, ge=1)):
    # Cloudflare attacks
    cf_attacks = fetch_cloudflare_attacks(limit=50, date_range=f"{days}d")
    cf_attacks_processed = []

    for attack in cf_attacks:
        origin_coords = None
        target_coords = None

        # Attempt to geolocate IPs (may return None or [lat,lng])
        if attack.get("originIP"):
            origin_coords = geolocate_ip(attack["originIP"])
        if attack.get("targetIP"):
            target_coords = geolocate_ip(attack["targetIP"])

        # Fallback to country coords if needed
        if not origin_coords and attack.get("originCountryAlpha2"):
            c = countryCoords.get(attack["originCountryAlpha2"])
            if c:
                origin_coords = [c.get("lat"), c.get("lon")]
        if not target_coords and attack.get("targetCountryAlpha2"):
            c = countryCoords.get(attack["targetCountryAlpha2"])
            if c:
                target_coords = [c.get("lat"), c.get("lon")]

        # sanitize numeric values
        if origin_coords and target_coords:
            o_lat = safe_float(origin_coords[0])
            o_lng = safe_float(origin_coords[1])
            t_lat = safe_float(target_coords[0])
            t_lng = safe_float(target_coords[1])
            val = safe_float(attack.get("value", 1))

            if None in (o_lat, o_lng, t_lat, t_lng):
                # skip any arc with invalid coordinates
                continue

            cf_attacks_processed.append({
                "originLat": o_lat,
                "originLng": o_lng,
                "targetLat": t_lat,
                "targetLng": t_lng,
                "value": float(val) if val is not None else 1.0
            })

    # AbuseIPDB points
    df = load_abuseipdb_dataset()
    abuse_results = []

    if not df.empty:
        # sample safely
        df_sample = df.sample(n=min(100, len(df)))
        for _, row in df_sample.iterrows():
            ip_raw = row.get("ipAddress", "")
            latlon = None
            try:
                # Geolocate using original IP if present (utils.geolocate_ip must not store plaintext)
                latlon = geolocate_ip(ip_raw) if ip_raw else None
            except Exception:
                latlon = None

            # compute dos score (may return None)
            try:
                dos_score = score_ip(
                    ip_raw,
                    int(float(row.get("abuseConfidenceScore") or 0)),
                    row.get("countryCode") or "UNK"
                )
            except Exception:
                dos_score = None

            # sanitize latlon
            if latlon and isinstance(latlon, (list, tuple)) and len(latlon) >= 2:
                lat = safe_float(latlon[0])
                lon = safe_float(latlon[1])
                if lat is None or lon is None:
                    latlon = None
                else:
                    latlon = [lat, lon]

            # do not include raw IP; only include ipHash if present or omit
            ip_identifier = row.get("ipHash") or None

            abuse_results.append({
                "ipId": ip_identifier,            # hashed id or None
                "abuseConfidenceScore": safe_float(row.get("abuseConfidenceScore") or 0),
                "countryCode": row.get("countryCode") or "UNK",
                "latlon": latlon,
                "dos_score": int(dos_score) if (dos_score is not None and isinstance(dos_score, (int, float)) and math.isfinite(dos_score)) else None
            })

    return {
        "cloudflare": cf_attacks_processed,
        "abuseipdb": abuse_results
    }
