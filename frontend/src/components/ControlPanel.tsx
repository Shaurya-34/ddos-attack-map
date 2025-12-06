import { useState, useEffect } from 'react';
import { MetricCard } from './MetricCard';
import { IncidentRow } from './IncidentRow';
import { Activity, Zap } from 'lucide-react';
import { Attack, LiveMetrics } from '@/types/attack';
// Live data will be fetched from the backend; mock data imports removed
import { ScrollArea } from '@/components/ui/scroll-area';

export function ControlPanel({ onAttacksUpdate, onAbuseThreatUpdate, timeRange }: {
  onAttacksUpdate: (attacks: Attack[]) => void;
  onAbuseThreatUpdate?: (threats: any[]) => void;
  timeRange: string;
}) {
  // Initialize live data from backend
  const [metrics, setMetrics] = useState<LiveMetrics>({
    activeAttacks: 0,
    peakPps: 0,
    avgDuration: 0,
    totalAttacks24h: 0,
  });
  const [prevMetrics, setPrevMetrics] = useState<LiveMetrics>({
    activeAttacks: 0,
    peakPps: 0,
    avgDuration: 0,
    totalAttacks24h: 0,
  });
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Calculate trend percentages
  const calculateTrend = (current: number, previous: number): number | undefined => {
    if (previous === 0) return undefined;
    const change = ((current - previous) / previous) * 100;
    return Math.round(change);
  };

  const activeAttacksTrend = calculateTrend(metrics.activeAttacks, prevMetrics.activeAttacks);
  const peakPpsTrend = calculateTrend(metrics.peakPps, prevMetrics.peakPps);

  useEffect(() => {
    const fetchData = async () => {
      setIsRefreshing(true); // Start refresh animation
      try {
        // Use environment variable for API URL, fallback to empty for local dev (proxy)
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

        console.log('Fetching data from /combined with timeRange:', timeRange);
        // Map timeRange to backend date_range parameter
        const dateRangeMap: Record<string, string> = {
          'live': '1d',
          '5m': '1h',
          '1h': '1h',
          '24h': '1d'
        };
        const dateRange = dateRangeMap[timeRange] || '1d';
        const res = await fetch(`${API_BASE_URL}/combined?date_range=${dateRange}`);

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        console.log('Received data:', data);

        // Transform Cloudflare attacks to our Attack type
        const cloudflareAttacks = (data.cloudflare || []).map((a: any) => {
          const attackValue = a.value ?? 0;
          const packetsPerSec = attackValue * 1000;
          const severity = Math.min(100, Math.floor((attackValue / 100) * 100));

          return {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            source: 'cloudflare' as const,
            sourceCountry: a.originCountryAlpha2 ?? 'N/A',
            sourceIp: `${a.originLat?.toFixed(2) ?? '0'},${a.originLng?.toFixed(2) ?? '0'}`,
            sourceAsn: 'N/A',
            targetCountry: a.targetCountryAlpha2 ?? 'N/A',
            targetIp: `${a.targetLat?.toFixed(2) ?? '0'},${a.targetLng?.toFixed(2) ?? '0'}`,
            targetService: 'Web',
            protocol: 'TCP',
            packetsPerSec,
            severity,
            duration: 60,
            sourceCoords: { lat: a.originLat ?? 0, lon: a.originLng ?? 0 },
            targetCoords: { lat: a.targetLat ?? 0, lon: a.targetLng ?? 0 },
          };
        });

        // Transform AbuseIPDB threats
        const abuseThreats = (data.abuseipdb || []).map((t: any) => {
          const confidence = t.abuseConfidenceScore ?? 0;

          return {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            source: 'abuseipdb' as const,
            sourceCountry: t.countryCode ?? 'UNK',
            confidence: confidence,
            ipHash: t.ipId,
            sourceCoords: t.latlon ? { lat: t.latlon[0], lon: t.latlon[1] } : null,
          };
        });

        console.log('Transformed data:', { cloudflareAttacks, abuseThreats });

        // Combine both sources
        const allIncidents = [...cloudflareAttacks, ...abuseThreats];

        // Shuffle array using Fisher-Yates algorithm for random display order
        for (let i = allIncidents.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allIncidents[i], allIncidents[j]] = [allIncidents[j], allIncidents[i]];
        }

        // Only update if we have data
        if (allIncidents.length > 0) {
          setAttacks(allIncidents as any); // Combined & shuffled incidents
          onAttacksUpdate(cloudflareAttacks); // Only send Cloudflare to globe for arcs
          onAbuseThreatUpdate?.(abuseThreats); // Send AbuseIPDB to globe for purple dots

          // Store previous metrics before updating
          setPrevMetrics(metrics);

          // Update current metrics
          const newMetrics = {
            activeAttacks: cloudflareAttacks.length,
            peakPps: Math.max(...cloudflareAttacks.map(a => a.packetsPerSec), 0),
            avgDuration: 0,
            totalAttacks24h: data.abuseipdb?.length ?? 0,
          };
          setMetrics(newMetrics);
          setLastUpdated(new Date()); // Update timestamp
        }
      } catch (e) {
        console.error('Failed to fetch live data:', e);
        // Keep existing data on error - don't clear the screen
      } finally {
        // End refresh animation after a brief delay for visual feedback
        setTimeout(() => setIsRefreshing(false), 300);
      }
    };
    fetchData(); // Fetch once when component mounts or timeRange changes
    // Auto-refresh disabled to prevent slow reloads
    // Uncomment below to enable auto-refresh every 30 seconds:
    // const interval = setInterval(fetchData, 30000);
    // return () => clearInterval(interval);
  }, [timeRange, onAttacksUpdate]); // Refetch when time range changes

  return (
    <div className="h-full flex flex-col p-5">
      {/* Live Metrics */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Live Metrics
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            icon={Activity}
            label="Active"
            value={metrics.activeAttacks}
            trend={activeAttacksTrend}
          />
          <MetricCard
            icon={Zap}
            label="Peak PPS"
            value={(metrics.peakPps / 1000).toFixed(1)}
            unit="K"
            trend={peakPpsTrend}
          />
        </div>
      </div>

      {/* Incidents Feed */}
      <div className="flex-1 flex flex-col min-h-0 mt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Incidents
          </h2>
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground">
              Last checked: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <ScrollArea className={`flex-1 transition-opacity duration-300 ${isRefreshing ? 'opacity-50' : 'opacity-100'}`}>
          <div className="space-y-1 pr-3">
            {attacks.map(attack => (
              <IncidentRow key={attack.id} attack={attack} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
