import { useState, useEffect } from 'react';
import { MetricCard } from './MetricCard';
import { IncidentRow } from './IncidentRow';
import { Activity, Zap } from 'lucide-react';
import { Attack, LiveMetrics } from '@/types/attack';
// Live data will be fetched from the backend; mock data imports removed
import { ScrollArea } from '@/components/ui/scroll-area';

export function ControlPanel({ onAttacksUpdate, timeRange }: { onAttacksUpdate: (attacks: Attack[]) => void; timeRange: string }) {
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
        console.log('Fetching data from /combined with timeRange:', timeRange);
        // Map timeRange to backend date_range parameter
        const dateRangeMap: Record<string, string> = {
          'live': '1d',
          '5m': '1h',
          '1h': '1h',
          '24h': '1d'
        };
        const dateRange = dateRangeMap[timeRange] || '1d';
        const res = await fetch(`/combined?date_range=${dateRange}`);

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        console.log('Received data:', data);

        // Transform Cloudflare attacks to our Attack type
        const liveAttacks = (data.cloudflare || []).map((a: any) => {
          // Cloudflare's 'value' represents attack volume/intensity
          const attackValue = a.value ?? 0;
          // Convert to packets per second (multiply by a factor for realistic display)
          const packetsPerSec = attackValue * 1000; // Assuming value is in thousands
          // Calculate severity based on attack volume (0-100 scale)
          const severity = Math.min(100, Math.floor((attackValue / 100) * 100));

          return {
            id: crypto.randomUUID(),
            timestamp: new Date(),
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

        console.log('Transformed attacks:', liveAttacks);

        // Only update if we have data (prevents blank screen during slow fetches)
        if (liveAttacks.length > 0) {
          const limitedAttacks = liveAttacks.slice(0, 10); // Limit to 10 attacks
          setAttacks(limitedAttacks);
          onAttacksUpdate(limitedAttacks); // Update parent component

          // Store previous metrics before updating
          setPrevMetrics(metrics);

          // Update current metrics
          const newMetrics = {
            activeAttacks: liveAttacks.length,
            peakPps: Math.max(...liveAttacks.map(a => a.packetsPerSec), 0),
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
              Updated {lastUpdated.toLocaleTimeString()}
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
