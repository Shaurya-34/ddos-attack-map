import { Radio, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NavbarProps {
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
}

export function Navbar({ timeRange, onTimeRangeChange }: NavbarProps) {
  return (
    <nav className="h-16 glass border-b border-border">
      <div className="h-full flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Radio className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">
            ThreatPulse Monitor
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="outline" className="gap-2 px-2.5 py-1 border-primary/40">
            <Activity className="h-3 w-3 animate-pulse text-primary" />
            <span className="font-medium text-xs">LIVE</span>
          </Badge>

          <select
            value={timeRange}
            onChange={(e) => onTimeRangeChange(e.target.value)}
            className="bg-muted/50 px-3 py-1.5 rounded text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
          >
            <option value="live">Live</option>
            <option value="5m">Last 5m</option>
            <option value="1h">Last 1h</option>
            <option value="24h">Last 24h</option>
          </select>
        </div>
      </div>
    </nav>
  );
}
