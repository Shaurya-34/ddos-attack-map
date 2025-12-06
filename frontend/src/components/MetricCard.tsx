import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  color?: 'primary' | 'secondary' | 'destructive';
}

export function MetricCard({ icon: Icon, label, value, unit, trend }: MetricCardProps) {
  return (
    <Card className="bg-card/50 border-border p-3 hover:bg-card/70 transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <Icon className="h-4 w-4 text-primary" />
        {trend !== undefined && (
          <span className={`text-[10px] font-medium ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-semibold font-mono text-foreground">
            {value.toLocaleString()}
          </span>
          {unit && <span className="text-xs text-muted-foreground font-mono">{unit}</span>}
        </div>
      </div>
    </Card>
  );
}
