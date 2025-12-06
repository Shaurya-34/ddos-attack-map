import { Attack, LiveMetrics } from '@/types/attack';

const countries = [
  { code: 'US', name: 'United States', coords: { lat: 37.09, lon: -95.71 } },
  { code: 'CN', name: 'China', coords: { lat: 35.86, lon: 104.19 } },
  { code: 'RU', name: 'Russia', coords: { lat: 61.52, lon: 105.31 } },
  { code: 'GB', name: 'United Kingdom', coords: { lat: 55.37, lon: -3.43 } },
  { code: 'DE', name: 'Germany', coords: { lat: 51.16, lon: 10.45 } },
  { code: 'JP', name: 'Japan', coords: { lat: 36.20, lon: 138.25 } },
  { code: 'BR', name: 'Brazil', coords: { lat: -14.23, lon: -51.92 } },
  { code: 'IN', name: 'India', coords: { lat: 20.59, lon: 78.96 } },
  { code: 'FR', name: 'France', coords: { lat: 46.22, lon: 2.21 } },
  { code: 'AU', name: 'Australia', coords: { lat: -25.27, lon: 133.77 } },
];

const protocols = ['TCP', 'UDP', 'ICMP', 'HTTP', 'HTTPS', 'DNS'] as const;

const services = ['Web Server', 'DNS', 'Database', 'API Gateway', 'CDN', 'Email Server'];

function randomCountry() {
  return countries[Math.floor(Math.random() * countries.length)];
}

function randomProtocol() {
  return protocols[Math.floor(Math.random() * protocols.length)];
}

function randomService() {
  return services[Math.floor(Math.random() * services.length)];
}

function generateIp() {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function generateAsn() {
  return `AS${Math.floor(Math.random() * 65535)}`;
}

export function generateMockAttack(): Attack {
  const source = randomCountry();
  const target = randomCountry();
  const protocol = randomProtocol();
  const severity = Math.floor(Math.random() * 100);

  return {
    id: Math.random().toString(36).substr(2, 9),
    timestamp: new Date(),
    sourceCountry: source.code,
    sourceIp: generateIp(),
    sourceAsn: generateAsn(),
    targetCountry: target.code,
    targetIp: generateIp(),
    targetService: randomService(),
    protocol,
    packetsPerSec: Math.floor(Math.random() * 100000) + 1000,
    severity,
    duration: Math.floor(Math.random() * 300) + 10,
    sourceCoords: source.coords,
    targetCoords: target.coords,
  };
}

export function generateMockMetrics(): LiveMetrics {
  return {
    activeAttacks: Math.floor(Math.random() * 50) + 10,
    peakPps: Math.floor(Math.random() * 500000) + 50000,
    avgDuration: Math.floor(Math.random() * 120) + 30,
    totalAttacks24h: Math.floor(Math.random() * 5000) + 1000,
  };
}

export function getCountryName(code: string): string {
  return countries.find(c => c.code === code)?.name || code;
}
