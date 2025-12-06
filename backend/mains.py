import os
import requests
import pandas as pd
import json
import math
import hashlib
import random
import warnings
from fastapi import FastAPI, Query
from dotenv import load_dotenv
from backend.utils import score_ip   # geolocate_ip not used for AbuseIPDB
from fastapi.middleware.cors import CORSMiddleware

# Suppress sklearn warnings
warnings.filterwarnings('ignore', category=UserWarning, module='sklearn')

# Load environment variables
load_dotenv()
CLOUDFLARE_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN")
ABUSEIPDB_TOKEN = os.getenv("ABUSEIPDB_API_KEY")

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

def randomize_coords(lat, lon, offset_km=50):
    """Add random offset to coordinates for privacy (±offset_km)"""
    # 1 degree ≈ 111 km
    lat_offset = random.uniform(-offset_km/111, offset_km/111)
    lon_offset = random.uniform(-offset_km/111, offset_km/111)
    return lat + lat_offset, lon + lon_offset

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
#  LIVE ABUSEIPDB API FETCH
# ---------------------------
# Cache for AbuseIPDB data (to avoid rate limits)
abuseipdb_cache = {"data": None, "timestamp": None}
CACHE_DURATION = 86400  # 24 hours in seconds

def hash_ip(ip_address):
    """Hash an IP address using SHA-256 for privacy"""
    return hashlib.sha256(ip_address.encode()).hexdigest()

def fetch_live_abuseipdb_threats(limit=50):
    """Fetch live reported IPs from AbuseIPDB API with real-time hashing (cached for 24h)"""
    import time
    
    # Check cache first
    if abuseipdb_cache["data"] is not None and abuseipdb_cache["timestamp"] is not None:
        elapsed = time.time() - abuseipdb_cache["timestamp"]
        if elapsed < CACHE_DURATION:
            print(f"Using cached AbuseIPDB data ({int(elapsed/3600)}h old)")
            return abuseipdb_cache["data"]
    
    if not ABUSEIPDB_TOKEN:
        print("No AbuseIPDB token, skipping live fetch")
        return []
    
    url = "https://api.abuseipdb.com/api/v2/blacklist"
    headers = {
        "Key": ABUSEIPDB_TOKEN,
        "Accept": "application/json"
    }
    params = {
        "confidenceMinimum": 75,  # Only high-confidence threats
        "limit": limit
    }
    
    try:
        print(f"Fetching {limit} threats from AbuseIPDB...")
        resp = requests.get(url, headers=headers, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json().get("data", [])
        
        # Hash IPs in real-time for privacy
        threats = []
        for item in data:
            ip = item.get("ipAddress")
            if not ip:
                continue
                
            threats.append({
                "ipHash": hash_ip(ip),  # Real-time hashing
                "abuseConfidenceScore": item.get("abuseConfidenceScore", 0),
                "countryCode": item.get("countryCode") or "UNK"
            })
        
        print(f"Fetched and hashed {len(threats)} live threats")
        
        # Cache successful response
        abuseipdb_cache["data"] = threats
        abuseipdb_cache["timestamp"] = time.time()
        
        return threats
        
    except Exception as e:
        print("AbuseIPDB API error:", e)
        return []


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
            "source": "cloudflare",  # Source tag
            "originCountryAlpha2": origin_country,
            "targetCountryAlpha2": target_country,
            "originLat": safe_float(o_lat),
            "originLng": safe_float(o_lng),
            "targetLat": safe_float(t_lat),
            "targetLng": safe_float(t_lng),
            "value": safe_float(a.get("value", 1)) or 1.0
        })

    # -------------------------
    # Process AbuseIPDB (LIVE + FALLBACK)
    # -------------------------
    # Try live API first, fallback to CSV if unavailable
    live_threats = fetch_live_abuseipdb_threats(limit=50)
    
    if not live_threats:
        # Fallback to static dataset
        print("Using static AbuseIPDB dataset as fallback")
        df = load_abuseipdb_dataset()
        if not df.empty:
            df_sample = df.sample(n=min(50, len(df)))
            live_threats = df_sample.to_dict('records')
    
    abuse_out = []
    for threat in live_threats:
        ipId = threat.get("ipHash")
        abuse = safe_float(threat.get("abuseConfidenceScore") or 0)
        cc = threat.get("countryCode") or "UNK"

        # country-level coordinates with privacy randomization
        coords = countryCoords.get(cc)
        if coords:
            # Add random offset for privacy
            rand_lat, rand_lon = randomize_coords(coords["lat"], coords["lon"], offset_km=50)
            latlon = [rand_lat, rand_lon]
        else:
            latlon = None

        # ML score
        try:
            dos_score = score_ip(None, int(abuse or 0), cc)
        except Exception:
            dos_score = None

        abuse_out.append({
            "source": "abuseipdb",  # Source tag
            "ipId": ipId,
            "abuseConfidenceScore": abuse,
            "countryCode": cc,
            "latlon": latlon,
            "dos_score": int(dos_score) if dos_score is not None else None
        })

    # Randomize selection from both sources (10 from each)
    cf_random = random.sample(cf_out, min(10, len(cf_out))) if cf_out else []
    abuse_random = random.sample(abuse_out, min(10, len(abuse_out))) if abuse_out else []

    return {
        "cloudflare": cf_random, 
        "abuseipdb": abuse_random,
        "total": {
            "cloudflare_available": len(cf_out),
            "abuseipdb_available": len(abuse_out)
        }
    }

# ---------------------------
# Optional health check
# ---------------------------
@app.get("/")
def root():
    return {"status": "ok", "msg": "API running"}
