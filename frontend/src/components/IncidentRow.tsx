import { Attack } from '@/types/attack';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface IncidentRowProps {
  attack: Attack | any; // Extended to handle both types
  onClick?: () => void;
}

export function IncidentRow({ attack, onClick }: IncidentRowProps) {
  // Check if this is an AbuseIPDB threat or Cloudflare attack
  const isAbuse = attack.source === 'abuseipdb';

  if (isAbuse) {
    // AbuseIPDB Threat Display
    const confidence = attack.confidence ?? 0;
    const threatLevel = confidence >= 90 ? 'high' : confidence >= 75 ? 'med' : 'low';
    const threatColor = confidence >= 90 ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
      confidence >= 75 ? 'bg-purple-400/10 text-purple-300 border-purple-400/30' :
        'bg-purple-300/10 text-purple-200 border-purple-300/30';

    return (
      <button
        onClick={onClick}
        className="w-full bg-card/30 border border-purple-500/30 hover:bg-purple-500/10 rounded p-2.5 text-left transition-colors"
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-semibold text-purple-400">POTENTIAL THREAT</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${threatColor}`}>
            {threatLevel}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground font-mono">{attack.sourceCountry}</span>
          <span className="text-muted-foreground">{confidence}% confidence</span>
          <span className="text-muted-foreground">Detected: {formatDistanceToNow(attack.timestamp, { addSuffix: true })}</span>
        </div>
      </button>
    );
  }

  // Cloudflare Attack Display
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
        <span className="text-muted-foreground">Data updated: {formatDistanceToNow(attack.timestamp, { addSuffix: true })}</span>
      </div>
    </button>
  );
}
