import React, { useEffect, useMemo, useState, useCallback } from "react";
import GlobeT from "react-globe.gl";
import axios from "axios";

const BUCKET_DEG = 0.5; // aggregation size (bigger => more privacy)

interface AbuseIP {
  latlon?: [number, number];
  dos_score?: number | string;
  ipId?: string;
  ipHash?: string;
}

interface CloudflareAttack {
  originLat?: number | string;
  originLng?: number | string;
  targetLat?: number | string;
  targetLng?: number | string;
  value?: number | string;
}

export function Globe() {
  const [abuseIPs, setAbuseIPs] = useState<AbuseIP[]>([]);
  const [cfAttacks, setCfAttacks] = useState<any[]>([]);
  const [currentRange, setCurrentRange] = useState(5);
  const ranges = [3, 5, 7, 14];
  const [rangeIndex, setRangeIndex] = useState(1);
  const [loading, setLoading] = useState(false);

  const jitter = (lat: number, lon: number, maxOffset = 0.2) => ({
    lat: lat + (Math.random() - 0.5) * maxOffset,
    lon: lon + (Math.random() - 0.5) * maxOffset
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // relative path so it works on prod (same origin) and local (proxy ok)
      const res = await axios.get(`/combined?days=${currentRange}`, { timeout: 8000 });

      setAbuseIPs(res.data?.abuseipdb || []);

      const arcs = (res.data?.cloudflare || [])
        .map((d: CloudflareAttack) => {
          if (!d.originLat || !d.originLng || !d.targetLat || !d.targetLng) return null;
          const o = jitter(Number(d.originLat), Number(d.originLng));
          const t = jitter(Number(d.targetLat), Number(d.targetLng));
          return { startLat: o.lat, startLng: o.lon, endLat: t.lat, endLng: t.lon, value: Number(d.value) || 1 };
        })
        .filter(Boolean);

      setCfAttacks([]);
      setTimeout(() => setCfAttacks(arcs), 120);
    } catch (e) {
      console.error("fetch /combined failed:", e);
    } finally {
      setLoading(false);
    }
  }, [currentRange]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => {
      const next = (rangeIndex + 1) % ranges.length;
      setRangeIndex(next);
      setCurrentRange(ranges[next]);
    }, 20000);
    return () => clearInterval(timer);
  }, [rangeIndex, fetchData]);

  // aggregate abuse points into grid cells (no single-IP dots)
  const aggregatedPoints = useMemo(() => {
    const buckets = new Map<string, { lat: number; lon: number; count: number; maxScore: number; ids: string[] }>();
    for (const r of abuseIPs) {
      const loc = r?.latlon;
      if (!Array.isArray(loc) || loc.length < 2) continue;
      const lat = Number(loc[0]), lon = Number(loc[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const keyLat = Math.round(lat / BUCKET_DEG) * BUCKET_DEG;
      const keyLon = Math.round(lon / BUCKET_DEG) * BUCKET_DEG;
      const key = `${keyLat.toFixed(3)}_${keyLon.toFixed(3)}`;

      const cur = buckets.get(key) || { lat: keyLat, lon: keyLon, count: 0, maxScore: 0, ids: [] };
      cur.count += 1;
      const s = Number(r.dos_score) || 0;
      if (s > cur.maxScore) cur.maxScore = s;

      const id = r.ipId || r.ipHash || null; // backend never returns raw ip
      if (id && cur.ids.length < 3) cur.ids.push(id);

      buckets.set(key, cur);
    }

    return Array.from(buckets.values()).map(b => ({
      lat: b.lat + (Math.random() - 0.5) * (BUCKET_DEG * 0.3),
      lng: b.lon + (Math.random() - 0.5) * (BUCKET_DEG * 0.3),
      value: b.count,
      maxScore: b.maxScore,
      ids: b.ids
    }));
  }, [abuseIPs]);

  return (
    <div style={{ position: "relative", height: "100vh" }}>
      {/* control card */}
      <div style={{
        position: "absolute", zIndex: 3, top: 12, left: 12,
        background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.18))",
        color: "white", padding: "10px 14px", borderRadius: 12,
        boxShadow: "0 6px 18px rgba(0,0,0,0.4)", minWidth: 220,
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial"
      }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>DOS Attack Map</div>
        <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6 }}>
          Aggregated ({BUCKET_DEG}°) abuse points + Cloudflare arcs.
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button onClick={() => fetchData()} style={{ flex: 1, padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "none", color: "white", cursor: "pointer" }}>Refresh</button>
          <button onClick={() => { setCurrentRange(1); fetchData(); }} style={{ padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "none", color: "white", cursor: "pointer" }}>Now</button>
        </div>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12 }}>Range: {currentRange}d</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>{loading ? "Loading…" : "Ready"}</div>
        </div>
      </div>

      <GlobeT
        height={window.innerHeight}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

        // aggregated abuse points
        pointsData={aggregatedPoints}
        pointLat={(d: any) => d.lat}
        pointLng={(d: any) => d.lng}
        pointAltitude={(d: any) => 0.02 + Math.log1p(d.value) * 0.01}
        pointRadius={(d: any) => 0.2 + Math.sqrt(d.value) * 0.15}
        pointColor={(d: any) => d.maxScore >= 90 ? "crimson" : d.maxScore >= 50 ? "orange" : "gold"}
        pointLabel={(d: any) => `Count: ${d.value}\nMax score: ${d.maxScore}\nIDs: ${d.ids.join(", ")}`}

        // cloudflare arcs
        arcsData={cfAttacks}
        arcStartLat={(d: any) => d.startLat}
        arcStartLng={(d: any) => d.startLng}
        arcEndLat={(d: any) => d.endLat}
        arcEndLng={(d: any) => d.endLng}
        arcColor={() => "#ff4d4d"}
        arcDashLength={0.4}
        arcDashGap={0.02}
        arcDashAnimateTime={2500}
        animateIn
      />
    </div>
  );
}
