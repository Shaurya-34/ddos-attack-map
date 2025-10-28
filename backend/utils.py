# backend/utils.py
import os
import requests
import csv
import joblib
import numpy as np
import pandas as pd
import hmac
import hashlib
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
IPINFO_TOKEN = os.getenv("IPINFO_TOKEN")
IP_HMAC_KEY = os.getenv("IP_HMAC_KEY")

if not IP_HMAC_KEY:
    # fail loudly in dev so you don't accidentally write plaintext caches
    raise RuntimeError("IP_HMAC_KEY not set in environment (.env). Set IP_HMAC_KEY before running.")

IP_HMAC_KEY_BYTES = IP_HMAC_KEY.encode("utf-8")

# Project root (so paths work everywhere)
BASE_DIR = os.path.dirname(os.path.dirname(__file__))

# Path to cache CSV (relative)
CACHE_FILE = os.path.join(BASE_DIR, "data", "ip_cache.csv")

# Utility: HMAC an IP to a stable hex identifier
def ip_hmac(ip: str) -> str:
    if ip is None:
        return ""
    if not isinstance(ip, str):
        ip = str(ip)
    return hmac.new(IP_HMAC_KEY_BYTES, ip.encode("utf-8"), hashlib.sha256).hexdigest()

# Load existing cache into a dictionary keyed by ipHash
ip_cache = {}
if os.path.exists(CACHE_FILE):
    try:
        with open(CACHE_FILE, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            for row in reader:
                # Expect rows: ipHash,lat,lon  (no plaintext IPs)
                if not row or len(row) < 3:
                    continue
                iph, lat, lon = row[0], row[1], row[2]
                try:
                    ip_cache[iph] = [float(lat), float(lon)]
                except Exception:
                    # skip malformed rows
                    continue
    except Exception as e:
        print(f"Warning: failed to load ip cache {CACHE_FILE}: {e}")

# Load ML model
MODEL_FILE = os.path.join(BASE_DIR, "backend", "models", "ip_classifier.joblib")
ip_model = joblib.load(MODEL_FILE) if os.path.exists(MODEL_FILE) else None

# Load encoder
ENCODER_FILE = os.path.join(BASE_DIR, "backend", "models", "country_encoder.joblib")
encoder = joblib.load(ENCODER_FILE) if os.path.exists(ENCODER_FILE) else None
if encoder is None:
    # Do not raise here if model isn't present in some environments,
    # but notify so calls to score_ip can behave.
    print("Warning: Encoder file not found. score_ip will return None unless encoder present.")

def geolocate_ip(ip: str):
    """
    Returns [lat, lon] for the given ip.
    Uses HMAC(ip) for cache key. Does NOT store plaintext IP anywhere.
    """
    try:
        iph = ip_hmac(ip)
    except Exception as e:
        print(f"Error hashing IP {ip}: {e}")
        return None

    # Check cache
    if iph in ip_cache:
        return ip_cache[iph]

    # Not cached -> query IP provider (ipinfo)
    if not IPINFO_TOKEN:
        print("IPINFO_TOKEN not set; cannot geolocate unknown IP.")
        return None

    try:
        url = f"https://ipinfo.io/{ip}/json?token={IPINFO_TOKEN}"
        resp = requests.get(url, timeout=6)
        resp.raise_for_status()
        data = resp.json()

        if "loc" in data and isinstance(data["loc"], str):
            try:
                lat, lon = map(float, data["loc"].split(","))
            except Exception as e:
                print(f"Error parsing loc for {ip}: {e}")
                return None

            # Persist using ipHash, NOT plaintext IP
            ip_cache[iph] = [lat, lon]
            try:
                # append to CSV as ipHash,lat,lon
                with open(CACHE_FILE, "a", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    writer.writerow([iph, lat, lon])
            except Exception as e:
                print(f"Warning: failed to append to cache file: {e}")
            return [lat, lon]

        # if no 'loc' available, return None
        return None

    except requests.RequestException as e:
        print(f"Error geolocating {ip}: {e}")
    except Exception as e:
        print(f"Unexpected error geolocating {ip}: {e}")

    return None

def score_ip(ip, abuse_score:float=0.0, country_code="UNK"):
    """
    Returns model prediction (int) if model+encoder present, else None.
    Input ip is unused for scoring (we rely on country_code + abuse_score).
    """
    if ip_model is None or encoder is None:
        return None

    try:
        X_encoded = encoder.transform([[country_code]])
        X_final = pd.DataFrame(X_encoded, columns=encoder.get_feature_names_out(["countryCode"]))
        X_final["abuseConfidenceScore"] = abuse_score
        pred = ip_model.predict(X_final)
        return int(pred[0])
    except Exception as e:
        print(f"Error scoring IP {ip}: {e}")
        return None
