import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Globe } from '@/components/Globe';
import { ControlPanel } from '@/components/ControlPanel';
import { Attack } from '@/types/attack';

const Index = () => {
  const [allAttacks, setAllAttacks] = useState<Attack[]>([]);
  const [allThreats, setAllThreats] = useState<any[]>([]);
  const [displayedAttacks, setDisplayedAttacks] = useState<Attack[]>([]);
  const [displayedThreats, setDisplayedThreats] = useState<any[]>([]);
  const [cycleIndex, setCycleIndex] = useState(0);
  const [timeRange, setTimeRange] = useState<string>('live');
  const [isGlobeRefreshing, setIsGlobeRefreshing] = useState(false);

  // Trigger globe animation when displayed attacks update
  useEffect(() => {
    if (displayedAttacks.length > 0) {
      setIsGlobeRefreshing(true);
      setTimeout(() => setIsGlobeRefreshing(false), 75); // Ultra-fast transition
    }
  }, [displayedAttacks]);

  // Cycle through attacks every 8 seconds
  useEffect(() => {
    if (allAttacks.length === 0 && allThreats.length === 0) return;

    const updateDisplay = () => {
      const attacksToShow = 10;
      const threatsToShow = 10;

      // Get current slice of attacks (cycling)
      const attackStart = cycleIndex % Math.max(1, allAttacks.length);
      const attackSlice = allAttacks.slice(attackStart, attackStart + attacksToShow);

      // Get current slice of threats (cycling)
      const threatStart = cycleIndex % Math.max(1, allThreats.length);
      const threatSlice = allThreats.slice(threatStart, threatStart + threatsToShow);

      setDisplayedAttacks(attackSlice.length > 0 ? attackSlice : allAttacks.slice(0, attacksToShow));
      setDisplayedThreats(threatSlice.length > 0 ? threatSlice : allThreats.slice(0, threatsToShow));
    };

    updateDisplay();

    const interval = setInterval(() => {
      setCycleIndex(prev => prev + 5); // Shift by 5 each cycle for variety
    }, 13000); // Cycle every 13 seconds

    return () => clearInterval(interval);
  }, [allAttacks, allThreats, cycleIndex]);

  const handleAttacksUpdate = (attacks: Attack[]) => {
    setAllAttacks(attacks);
  };

  const handleThreatsUpdate = (threats: any[]) => {
    setAllThreats(threats);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar timeRange={timeRange} onTimeRangeChange={setTimeRange} />

      <main className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
        {/* Globe Section */}
        <div className={`flex-1 relative transition-opacity duration-100 ${isGlobeRefreshing ? 'opacity-70' : 'opacity-100'}`}>
          <Globe attacks={displayedAttacks} abuseThreats={displayedThreats} />
        </div>

        {/* Control Panel */}
        <aside className="w-full lg:w-[420px] border-t lg:border-t-0 lg:border-l border-border glass">
          <ControlPanel
            onAttacksUpdate={handleAttacksUpdate}
            onAbuseThreatUpdate={handleThreatsUpdate}
            timeRange={timeRange}
          />
        </aside>
      </main>
    </div>
  );
};

export default Index;
