#!/usr/bin/env python3
import os, csv, hmac, hashlib, sys
from dotenv import load_dotenv

load_dotenv()
KEY = os.getenv("IP_HMAC_KEY")
if not KEY:
    print("ERROR: set IP_HMAC_KEY in your .env before running.")
    sys.exit(1)
KEY = KEY.encode("utf-8")

BASE = os.path.dirname(os.path.dirname(__file__))  # repo root if script in scripts/
SRC = os.path.join(BASE, "data", "ip_cache.csv.bak")
DST = os.path.join(BASE, "data", "ip_cache_hashed.csv")

if not os.path.exists(SRC):
    print(f"ERROR: source file not found: {SRC}")
    sys.exit(1)

def ip_hash(ip: str) -> str:
    return hmac.new(KEY, ip.encode("utf-8"), hashlib.sha256).hexdigest()

count_in = 0
count_out = 0
with open(SRC, newline="", encoding="utf-8") as fin, open(DST, "w", newline="", encoding="utf-8") as fout:
    reader = csv.reader(fin)
    writer = csv.writer(fout)
    for row in reader:
        if not row or len(row) < 3:
            continue
        ip = row[0].strip()
        lat = row[1].strip()
        lon = row[2].strip()
        if not ip:
            continue
        count_in += 1
        try:
            writer.writerow([ip_hash(ip), lat, lon])
            count_out += 1
        except Exception as e:
            print("WARN: skipping row:", row, e)

print(f"Done. rows read: {count_in}, rows written: {count_out}")
print(f"Hashed cache written to: {DST}")
print("If satisfied, replace original file with: Move-Item .\\data\\ip_cache_hashed.csv .\\data\\ip_cache.csv -Force")
