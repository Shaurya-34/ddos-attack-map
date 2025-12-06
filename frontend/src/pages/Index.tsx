import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Globe } from '@/components/Globe';
import { ControlPanel } from '@/components/ControlPanel';
import { Attack } from '@/types/attack';

const Index = () => {
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [timeRange, setTimeRange] = useState<string>('live');
  const [isGlobeRefreshing, setIsGlobeRefreshing] = useState(false);

  // Trigger globe animation when attacks update
  useEffect(() => {
    if (attacks.length > 0) {
      setIsGlobeRefreshing(true);
      setTimeout(() => setIsGlobeRefreshing(false), 300);
    }
  }, [attacks]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar timeRange={timeRange} onTimeRangeChange={setTimeRange} />

      <main className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
        {/* Globe Section */}
        <div className={`flex-1 relative transition-opacity duration-300 ${isGlobeRefreshing ? 'opacity-70' : 'opacity-100'}`}>
          <Globe attacks={attacks} />
        </div>

        {/* Control Panel */}
        <aside className="w-full lg:w-[420px] border-t lg:border-t-0 lg:border-l border-border glass">
          <ControlPanel onAttacksUpdate={setAttacks} timeRange={timeRange} />
        </aside>
      </main>
    </div>
  );
};

export default Index;
