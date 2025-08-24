import os
import requests
import csv
import joblib
import numpy as np
import pandas as pd  
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
IPINFO_TOKEN = os.getenv("IPINFO_TOKEN")

# Project root (so paths work everywhere)
BASE_DIR = os.path.dirname(os.path.dirname(__file__))

# Path to cache CSV (relative)
CACHE_FILE = os.path.join(BASE_DIR, "data", "ip_cache.csv")

# Load existing cache into a dictionary
ip_cache = {}
if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            ip, lat, lon = row
            ip_cache[ip] = [float(lat), float(lon)]

# Load ML model
MODEL_FILE = os.path.join(BASE_DIR, "backend", "models", "ip_classifier.joblib")
ip_model = joblib.load(MODEL_FILE) if os.path.exists(MODEL_FILE) else None

# Load encoder
ENCODER_FILE = os.path.join(BASE_DIR, "backend", "models", "country_encoder.joblib")   
encoder = joblib.load(ENCODER_FILE) if os.path.exists(ENCODER_FILE) else None
if encoder is None:
    raise RuntimeError("Encoder file not found. Please retrain the model.")

def geolocate_ip(ip):
    if ip in ip_cache:
        return ip_cache[ip]

    try:
        url = f"https://ipinfo.io/{ip}/json?token={IPINFO_TOKEN}"
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        if "loc" in data:
            lat, lon = map(float, data["loc"].split(","))
            ip_cache[ip] = [lat, lon]
            with open(CACHE_FILE, "a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([ip, lat, lon])
            return [lat, lon]
    except requests.RequestException as e:
        print(f"Error geolocating {ip}: {e}")

    return [0, 0]

def score_ip(ip, abuse_score=0, country_code="UNK"):
    if ip_model is None or encoder is None:
        return None

    try:
        X_encoded = encoder.transform([[country_code]])
        X_final = pd.DataFrame(X_encoded, columns=encoder.get_feature_names_out(["countryCode"]))
        X_final["abuseConfidenceScore"] = abuse_score

        return int(ip_model.predict(X_final)[0])
    except Exception as e:
        print(f"Error scoring IP {ip}: {e}")
        return None
