import React, { useEffect, useState, useCallback } from "react";
import Globe from "react-globe.gl";
import axios from "axios";

const AttackGlobe = () => {
  const [abuseIPs, setAbuseIPs] = useState([]);
  const [cfAttacks, setCfAttacks] = useState([]);
  const [currentRange, setCurrentRange] = useState(5);
  const [rangeText, setRangeText] = useState("5");
  const ranges = [5, 7, 9];
  const [rangeIndex, setRangeIndex] = useState(0);

  // Small jitter to prevent overlapping arcs
  const jitter = (lat, lon, maxOffset = 0.5) => ({
    lat: lat + (Math.random() - 0.5) * maxOffset,
    lon: lon + (Math.random() - 0.5) * maxOffset
  });

  // Fetch data for current range
  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get(`http://127.0.0.1:8000/combined?days=${currentRange}`);

      // AbuseIPDB points
      setAbuseIPs(res.data.abuseipdb);

      // Cloudflare arcs
      const newArcs = res.data.cloudflare
        .map(d => {
          if (!d.originLat || !d.originLng || !d.targetLat || !d.targetLng) return null;

          const origin = jitter(Number(d.originLat), Number(d.originLng));
          const target = jitter(Number(d.targetLat), Number(d.targetLng));

          return {
            startLat: origin.lat,
            startLng: origin.lon,
            endLat: target.lat,
            endLng: target.lon,
            value: Number(d.value) || 1
          };
        })
        .filter(Boolean);

      // Smooth transition for arcs
      setCfAttacks([]);
      setTimeout(() => setCfAttacks(newArcs), 150);

    } catch (err) {
      console.error("Error fetching combined data:", err);
    }
  }, [currentRange]);

  // Rotate time ranges every 15 seconds
  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      const nextIndex = (rangeIndex + 1) % ranges.length;
      setRangeIndex(nextIndex);
      setCurrentRange(ranges[nextIndex]);
      setRangeText(ranges[nextIndex]);
    }, 15000);

    return () => clearInterval(interval);
  }, [rangeIndex, fetchData]);

  return (
    <div style={{ position: "relative" }}>
      {/* Top-left overlay showing current range */}
      <div style={{
        position: "absolute",
        zIndex: 2,
        top: 10,
        left: 10,
        color: "white",
        fontSize: "16px",
        fontWeight: "bold",
        backgroundColor: "rgba(0,0,0,0.4)",
        padding: "5px 10px",
        borderRadius: "5px"
      }}>
        Showing attacks from last {rangeText} days
      </div>

      <Globe
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

        // AbuseIPDB points
        pointsData={abuseIPs}
        pointLat={d => d.latlon?.[0]}
        pointLng={d => d.latlon?.[1]}
        pointColor={d => d.dos_score === 1 ? "red" : "yellow"} // red/yellow logic preserved
        pointAltitude={0.02}
        pointRadius={0.4}

        // Cloudflare arcs
        arcsData={cfAttacks}
        arcStartLat={d => d.startLat}
        arcStartLng={d => d.startLng}
        arcEndLat={d => d.endLat}
        arcEndLng={d => d.endLng}
        arcColor={() => "#ff0000"}
        arcDashLength={0.3}
        arcDashGap={0.01}
        arcDashAnimateTime={2000}
      />
    </div>
  );
};

export default AttackGlobe;
