export interface Attack {
  id: string;
  timestamp: Date;
  sourceCountry: string;
  sourceIp: string;
  sourceAsn: string;
  targetCountry: string;
  targetIp: string;
  targetService: string;
  protocol: 'TCP' | 'UDP' | 'ICMP' | 'HTTP' | 'HTTPS' | 'DNS';
  packetsPerSec: number;
  severity: number; // 0-100
  duration: number; // seconds
  sourceCoords: { lat: number; lon: number };
  targetCoords: { lat: number; lon: number };
}

export interface LiveMetrics {
  activeAttacks: number;
  peakPps: number;
  avgDuration: number;
  totalAttacks24h: number;
}

export interface FilterState {
  severity: [number, number];
  protocols: Set<string>;
  regions: Set<string>;
  timeWindow: '5m' | '1h' | '24h' | 'live';
  showSimulated: boolean;
}
