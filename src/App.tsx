/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map } from './components/Map';
import { Timeline } from './components/Timeline';
import { Compass } from './components/Compass';
import { DetailPanel } from './components/DetailPanel';
import { ReferencePanel } from './components/ReferencePanel';
import { landmarks as initialLandmarks, Landmark } from './data/landmarks';
import { fetchArchitecturalLandmarks } from './services/dataService';
import { Search, Info, Map as MapIcon, Loader2, Globe, X } from 'lucide-react';

export default function App() {
  const [selectedYear, setSelectedYear] = useState(1850);
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [visibleInView, setVisibleInView] = useState(0);
  const [landmarks, setLandmarks] = useState<Landmark[]>(initialLandmarks);
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [navigationTransition, setNavigationTransition] = useState<{ from: Landmark; to: Landmark } | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setDataError(null);
      try {
        const dynamicLandmarks = await fetchArchitecturalLandmarks();
        
        // Merge with seed landmarks
        const allLandmarks = [...initialLandmarks, ...dynamicLandmarks];
        
        // Remove duplicates by ID
        const uniqueLandmarks = Array.from(new Map(allLandmarks.map(l => [l.id, l])).values());

        setLandmarks(uniqueLandmarks);
      } catch (err: any) {
        console.warn("Archive synchronization failed, using seed data:", err);
        // Fallback to seed data if fetch fails
        setLandmarks(initialLandmarks);
        // Don't set dataError if we have seed data to show
        if (initialLandmarks.length === 0) {
          setDataError(err.message || "A critical error occurred while synchronizing with the global architectural archives.");
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Landmarks in the current era, ordered West to East
  const eraLandmarks = useMemo(() => {
    return landmarks
      .filter(l => Math.abs(l.construction_year_start - selectedYear) <= 50)
      .filter(l => !selectedCountry || l.country === selectedCountry)
      .sort((a, b) => a.longitude - b.longitude);
  }, [landmarks, selectedYear, selectedCountry]);

  const visibleInEra = eraLandmarks.length;

  const handleNext = () => {
    if (!selectedLandmark) return;
    const currentIndex = eraLandmarks.findIndex(l => l.id === selectedLandmark.id);
    if (currentIndex !== -1) {
      const nextIndex = (currentIndex + 1) % eraLandmarks.length;
      const nextLandmark = eraLandmarks[nextIndex];
      
      // Set transition for animation
      setNavigationTransition({ from: selectedLandmark, to: nextLandmark });
      
      // Delay selection until zoom completes (Arc 800ms + Zoom 700ms)
      setTimeout(() => {
        setSelectedLandmark(nextLandmark);
      }, 1550);

      // Clear transition after line fade-out (Zoom finishes at 1550ms + 300ms pause)
      setTimeout(() => {
        setNavigationTransition(null);
      }, 1850);
    }
  };

  const currentIndex = selectedLandmark ? eraLandmarks.findIndex(l => l.id === selectedLandmark.id) + 1 : 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-parchment selection:bg-charcoal selection:text-parchment">
      {/* Loading Indicator */}
      {isLoading && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-parchment/80 backdrop-blur-md px-4 py-2 rounded-full border border-charcoal/10 flex items-center gap-3 shadow-lg">
          <Loader2 size={14} className="animate-spin text-charcoal/40" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-charcoal/60">Synchronizing Archive...</span>
        </div>
      )}

      {/* Error Overlay */}
      {dataError && (
        <div className="fixed inset-0 bg-charcoal/90 backdrop-blur-xl z-[200] flex items-center justify-center p-8">
          <div className="bg-parchment max-w-md w-full p-8 rounded-2xl shadow-2xl space-y-6 border border-red-500/20">
            <div className="space-y-2">
              <h2 className="text-2xl font-serif italic text-red-600">Archive Sync Failure</h2>
              <p className="font-mono text-[10px] uppercase tracking-widest text-charcoal/40">Critical Data Integrity Error</p>
            </div>
            <p className="font-serif text-charcoal/80 leading-relaxed">
              {dataError}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-charcoal text-parchment font-mono text-[10px] uppercase tracking-widest rounded-full hover:bg-charcoal/80 transition-colors"
            >
              Attempt Re-Synchronization
            </button>
          </div>
        </div>
      )}

      {/* Main Map View */}
      <Map 
        landmarks={eraLandmarks}
        onSelectLandmark={setSelectedLandmark}
        onVisibleInViewChange={setVisibleInView}
        selectedLandmarkId={selectedLandmark?.id}
        selectedCountry={selectedCountry}
        onCountryClick={setSelectedCountry}
        navigationTransition={navigationTransition}
      />

      {/* Reference Panel (Archive Index) */}
      <AnimatePresence>
        {isIndexOpen && (
          <ReferencePanel 
            totalLandmarks={landmarks.length}
            visibleInEra={visibleInEra}
            visibleInView={visibleInView}
            currentYear={selectedYear}
            onClose={() => setIsIndexOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Compass Rose */}
      <Compass />

      {/* Timeline Scrubber */}
      <Timeline 
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
      />

      {/* Detail Panel */}
      <DetailPanel 
        landmark={selectedLandmark}
        onClose={() => setSelectedLandmark(null)}
        onNext={handleNext}
        currentIndex={currentIndex}
        totalInSequence={eraLandmarks.length}
      />

      {/* Top Left: Title Card */}
      <div className="fixed top-8 left-8 z-30 flex flex-col gap-4">
        <div className="relative p-8 bg-parchment border border-charcoal/10 shadow-2xl archival-grain">
          {/* Jagged edge simulation with clip-path or pseudo-elements could be complex, 
              using a clean bordered box with archival feel for now */}
          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="w-1.5 h-1.5 bg-charcoal rotate-45" />
              <h1 className="text-3xl font-serif font-bold tracking-tight uppercase">Archival Atlas</h1>
              <div className="w-1.5 h-1.5 bg-charcoal rotate-45" />
            </div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-charcoal/60">
              Historical Architectural Records & Statistics
            </p>
          </div>
          
          {/* Decorative corners */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-charcoal/20" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-charcoal/20" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-charcoal/20" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-charcoal/20" />
        </div>

        {/* Country Focus Indicator */}
        <AnimatePresence>
          {selectedCountry && (
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="bg-charcoal text-parchment px-6 py-4 shadow-2xl border border-parchment/10 archival-grain relative min-w-[200px]"
            >
              <div className="flex flex-col pr-8">
                <span className="font-mono text-[8px] uppercase tracking-widest text-parchment/40">Focus Mode</span>
                <span className="font-serif text-xl italic">{selectedCountry}</span>
              </div>
              
              <button 
                onClick={() => setSelectedCountry(null)}
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-parchment/10 hover:bg-parchment/20 flex items-center justify-center transition-colors"
                title="Exit Country Focus"
              >
                <X size={12} className="text-parchment/60" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Top Right: Info Button */}
      <div className="fixed top-8 right-8 z-30">
        <button 
          onClick={() => setIsAboutOpen(true)}
          className="w-10 h-10 bg-parchment/80 backdrop-blur-md border border-charcoal/10 rounded-full flex items-center justify-center text-charcoal/60 hover:bg-charcoal hover:text-parchment transition-all shadow-lg"
          title="About the Archive"
        >
          <Info size={18} />
        </button>
      </div>

      {/* About Overlay */}
      <AnimatePresence>
        {isAboutOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-[60] flex items-center justify-center p-6" 
            onClick={() => setIsAboutOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-charcoal text-parchment max-w-lg w-full p-10 shadow-2xl archival-grain border border-parchment/10 relative"
              onClick={e => e.stopPropagation()}
            >
              {/* Close Button */}
              <button 
                onClick={() => setIsAboutOpen(false)}
                className="absolute top-4 right-4 text-parchment/30 hover:text-parchment transition-colors"
              >
                <span className="font-mono text-[10px] uppercase tracking-widest">Close [x]</span>
              </button>

              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-2xl font-serif italic tracking-tight">About the Archive</h2>
                  <div className="h-[1px] w-12 bg-parchment/20" />
                </div>
                
                <div className="space-y-4 font-serif text-base leading-relaxed text-parchment/80 italic">
                  <p>
                    This atlas traces the story of architecture across the world through time. As you move through the years, you’ll discover how vastly different cultures were building in parallel—often at the same moment, yet in completely different ways.
                  </p>
                  <p>
                    What may seem distant in geography is deeply connected in history. Use the timeline below to navigate through eras, select marked years, and explore places to learn why these structures were built, what influenced them, and what they reveal about the world at that time.
                  </p>
                  <p className="pt-2 border-t border-parchment/10">
                    A quiet record of human ambition, belief, and craft—mapped across centuries.
                  </p>
                </div>

                <div className="pt-6 flex flex-col items-center gap-4">
                  <div className="w-1.5 h-1.5 bg-parchment/20 rotate-45" />
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-parchment/40">
                    Made with love by Sanjay
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none archival-grain opacity-50 z-[100]" />
    </div>
  );
}
