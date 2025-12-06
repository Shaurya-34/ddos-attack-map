import { Attack } from '@/types/attack';
import { Badge } from '@/components/ui/badge';
import { getCountryName } from '@/utils/mockData';
import { formatDistanceToNow } from 'date-fns';

interface IncidentRowProps {
  attack: Attack;
  onClick?: () => void;
}

export function IncidentRow({ attack, onClick }: IncidentRowProps) {
  const severityColor = attack.severity > 75 ? 'destructive' : attack.severity > 40 ? 'default' : 'secondary';

  return (
    <button
      onClick={onClick}
      className="w-full bg-card/30 border border-border hover:bg-card/50 rounded p-2.5 text-left transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-mono text-muted-foreground">
          {attack.sourceCountry} → {attack.targetCountry}
        </span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${severityColor === 'destructive' ? 'bg-destructive/10 text-destructive border-destructive/30' :
            severityColor === 'default' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' :
              'bg-green-500/10 text-green-500 border-green-500/30'
          }`}>
          {attack.severity > 75 ? 'high' : attack.severity > 40 ? 'med' : 'low'}
        </Badge>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground font-mono">{attack.protocol}</span>
        <span className="text-muted-foreground font-mono">{(attack.packetsPerSec / 1000).toFixed(1)}K pps</span>
        <span className="text-muted-foreground">{formatDistanceToNow(attack.timestamp, { addSuffix: true })}</span>
      </div>
    </button>
  );
}
