/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SlidersHorizontal, List, Compass, X } from 'lucide-react';

import { Map } from './components/Map';
import type { AICursorState } from './components/Map';
import { ChatDock } from './components/ChatDock';
import { TravelControls } from './components/TravelControls';
import { TripSummary } from './components/TripSummary';
import { RecommendationPanel } from './components/RecommendationPanel';
import { DetailPanel } from './components/DetailPanel';

import { destinations, Destination } from './data/destinations';
import { TripParams, AIResponse, TourStop } from './services/travelService';

type AppMode = 'explore' | 'build' | 'flight';

const DEFAULT_PARAMS: TripParams = {
  origin: 'New York',
  budget: 3000,
  duration: 10,
  season: 'summer',
};

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  disabled?: boolean;
  onClick: () => void;
}

function ActionButton({ icon, label, active, badge, disabled, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all border ${
        active
          ? 'bg-ink text-parchment border-ink'
          : disabled
          ? 'bg-parchment/50 text-ink/20 border-ink/5 cursor-not-allowed'
          : 'bg-parchment/90 backdrop-blur-sm text-ink/50 border-ink/10 hover:text-ink hover:bg-parchment hover:border-ink/20'
      }`}
    >
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald text-parchment rounded-full font-mono text-[7px] flex items-center justify-center font-bold">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

export default function App() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [suggestedIds, setSuggestedIds] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [tripParams, setTripParams] = useState<TripParams>(DEFAULT_PARAMS);
  const [mode, setMode] = useState<AppMode>('explore');

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false);
  const [detailDestination, setDetailDestination] = useState<Destination | null>(null);

  // AI tour cursor
  const [aiCursor, setAiCursor] = useState<AICursorState | null>(null);
  const tourAbortRef = useRef(false);
  const skipResolverRef = useRef<(() => void) | null>(null);

  const selectedDestinations = useMemo(
    () =>
      selectedIds
        .map((id) => destinations.find((d) => d.id === id))
        .filter((d): d is Destination => !!d),
    [selectedIds]
  );

  const suggestedDestinations = useMemo(
    () =>
      suggestedIds
        .map((id) => destinations.find((d) => d.id === id))
        .filter((d): d is Destination => !!d),
    [suggestedIds]
  );

  const handleSelectDestination = useCallback((dest: Destination) => {
    setFocusedId(dest.id);
    setDetailDestination(dest);
    setIsControlsOpen(false);
    setIsSummaryOpen(false);
  }, []);

  const handleAddToTrip = useCallback((dest: Destination) => {
    setSelectedIds((prev) => (prev.includes(dest.id) ? prev : [...prev, dest.id]));
  }, []);

  const handleRemoveFromTrip = useCallback(
    (id: string) => {
      if (id === '__clear_all__') {
        setSelectedIds([]);
        return;
      }
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      if (detailDestination?.id === id) setDetailDestination(null);
    },
    [detailDestination]
  );

  const handleSkipTourStop = useCallback(() => {
    if (skipResolverRef.current) {
      skipResolverRef.current();
      skipResolverRef.current = null;
    }
  }, []);

  const stopTour = useCallback(() => {
    tourAbortRef.current = true;
    if (skipResolverRef.current) skipResolverRef.current();
    skipResolverRef.current = null;
    setAiCursor(null);
  }, []);

  const runTour = useCallback(async (script: TourStop[]) => {
    // Cancel any existing tour
    tourAbortRef.current = true;
    await new Promise((r) => setTimeout(r, 50));
    tourAbortRef.current = false;

    const skippable = () =>
      new Promise<void>((resolve) => {
        skipResolverRef.current = resolve;
      });

    for (let i = 0; i < script.length; i++) {
      if (tourAbortRef.current) break;
      const stop = script[i];
      const dest = destinations.find((d) => d.id === stop.destinationId);
      if (!dest) continue;

      // Move cursor to destination (no narration yet — let it travel)
      setAiCursor({ destination: dest, narration: stop.narration, isNarrating: false, stopIndex: i, totalStops: script.length });
      skipResolverRef.current = null;

      await Promise.race([new Promise<void>((r) => setTimeout(r, 1500)), skippable()]);
      if (tourAbortRef.current) break;

      // Start narration (typewriter begins)
      skipResolverRef.current = null;
      setAiCursor({ destination: dest, narration: stop.narration, isNarrating: true, stopIndex: i, totalStops: script.length });

      const readTime = Math.max(3500, stop.narration.length * 30);
      await Promise.race([new Promise<void>((r) => setTimeout(r, readTime)), skippable()]);
      if (tourAbortRef.current) break;

      // Hide narration before next move
      skipResolverRef.current = null;
      setAiCursor((prev) => (prev ? { ...prev, isNarrating: false } : null));
      await new Promise<void>((r) => setTimeout(r, 400));
    }

    if (!tourAbortRef.current) {
      await new Promise<void>((r) => setTimeout(r, 400));
      setAiCursor(null);
    }
  }, []);

  const handleAIResponse = useCallback((response: AIResponse) => {
    if (response.suggestedDestinationIds.length > 0) {
      setSuggestedIds(response.suggestedDestinationIds);
      setIsRecommendationOpen(true);
      setDetailDestination(null);
    }
    if (response.updatedParams && Object.keys(response.updatedParams).length > 0) {
      setTripParams((prev) => ({ ...prev, ...response.updatedParams }));
    }
    if (response.tourScript && response.tourScript.length > 0) {
      runTour(response.tourScript);
    }
  }, [runTour]);

  const handleParamsChange = useCallback((partial: Partial<TripParams>) => {
    setTripParams((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleModeChange = useCallback((newMode: AppMode) => {
    setMode(newMode);
    if (newMode === 'build' || newMode === 'flight') {
      setIsSummaryOpen(true);
      setIsControlsOpen(false);
    }
  }, []);

  const isDetailSelected = detailDestination
    ? selectedIds.includes(detailDestination.id)
    : false;

  return (
    <div className="relative w-screen h-screen overflow-hidden font-sans">
      {/* Map layer */}
      <Map
        destinations={destinations}
        selectedIds={selectedIds}
        suggestedIds={suggestedIds}
        focusedId={focusedId}
        mode={mode}
        origin={tripParams.origin}
        aiCursor={aiCursor}
        onSkipTourStop={handleSkipTourStop}
        onSelectDestination={handleSelectDestination}
      />

      {/* Global archival grain */}
      <div className="fixed inset-0 pointer-events-none z-[200] archival-grain opacity-35" />

      {/* ── Title card ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="fixed top-6 left-6 z-20"
      >
        <div className="relative bg-parchment/92 backdrop-blur-md border border-ink/10 shadow-2xl px-6 py-5">
          {/* Corner marks */}
          {[
            'top-0 left-0 border-t-2 border-l-2',
            'top-0 right-0 border-t-2 border-r-2',
            'bottom-0 left-0 border-b-2 border-l-2',
            'bottom-0 right-0 border-b-2 border-r-2',
          ].map((cls) => (
            <div key={cls} className={`absolute w-3 h-3 border-ink/20 ${cls}`} />
          ))}

          <div className="text-center space-y-0.5">
            <div className="flex items-center justify-center gap-2.5">
              <div className="w-1 h-1 bg-ink/30 rotate-45" />
              <h1 className="font-serif text-xl font-bold tracking-tight text-ink uppercase">
                Atlas
              </h1>
              <div className="w-1 h-1 bg-ink/30 rotate-45" />
            </div>
            <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-ink/40">
              The Modern Traveler's Companion
            </p>
          </div>

          {/* Mode pills */}
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {(['explore', 'build', 'flight'] as AppMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`font-mono text-[7px] uppercase tracking-widest px-2.5 py-1 rounded transition-all border ${
                  mode === m
                    ? 'bg-ink text-parchment border-ink'
                    : 'border-ink/15 text-ink/40 hover:text-ink/65 hover:border-ink/25'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Stat badges (top-right) ────────────────────────────────────────── */}
      <motion.div
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="fixed top-6 right-6 z-20 flex flex-col gap-2"
      >
        <div className="bg-parchment/90 backdrop-blur-md border border-ink/10 shadow-lg px-4 py-2.5 text-right">
          <p className="font-mono text-[8px] uppercase tracking-widest text-ink/35">
            World Destinations
          </p>
          <p className="font-mono text-lg font-bold text-ink leading-none mt-0.5">
            {destinations.length}
          </p>
        </div>

        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="bg-ink text-parchment px-4 py-2.5 shadow-lg text-right"
            >
              <p className="font-mono text-[8px] uppercase tracking-widest text-parchment/40">
                Trip Stops
              </p>
              <p className="font-mono text-lg font-bold leading-none mt-0.5">{selectedIds.length}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {suggestedIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="bg-emerald text-parchment px-4 py-2.5 shadow-lg text-right"
            >
              <p className="font-mono text-[8px] uppercase tracking-widest text-parchment/60">
                AI Suggests
              </p>
              <p className="font-mono text-lg font-bold leading-none mt-0.5">
                {suggestedIds.length}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Left action buttons ────────────────────────────────────────────── */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="fixed left-6 bottom-32 z-20 flex flex-col gap-2"
      >
        <ActionButton
          icon={<SlidersHorizontal size={15} />}
          label="Trip Controls"
          active={isControlsOpen}
          onClick={() => {
            setIsControlsOpen((o) => !o);
            if (!isControlsOpen) setIsSummaryOpen(false);
          }}
        />
        <ActionButton
          icon={<List size={15} />}
          label="Itinerary"
          active={isSummaryOpen}
          badge={selectedIds.length > 0 ? selectedIds.length : undefined}
          onClick={() => {
            setIsSummaryOpen((o) => !o);
            if (!isSummaryOpen) setIsControlsOpen(false);
          }}
        />
        <ActionButton
          icon={<Compass size={15} />}
          label="AI Suggestions"
          active={isRecommendationOpen}
          badge={suggestedIds.length > 0 ? suggestedIds.length : undefined}
          disabled={suggestedIds.length === 0}
          onClick={() => setIsRecommendationOpen((o) => !o)}
        />

        {/* Stop tour button — only visible while a tour is running */}
        <AnimatePresence>
          {aiCursor && (
            <motion.div
              key="stop-tour"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <button
                onClick={stopTour}
                title="Stop tour"
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border bg-red-50 text-red-400 border-red-200 hover:bg-red-100 hover:text-red-500 transition-all"
              >
                <X size={15} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Panels ────────────────────────────────────────────────────────── */}
      <TravelControls
        params={tripParams}
        mode={mode}
        isOpen={isControlsOpen}
        onClose={() => setIsControlsOpen(false)}
        onParamsChange={handleParamsChange}
        onModeChange={handleModeChange}
      />

      <TripSummary
        selectedDestinations={selectedDestinations}
        params={tripParams}
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        onRemove={handleRemoveFromTrip}
        onSelectDestination={handleSelectDestination}
      />

      <RecommendationPanel
        suggestedDestinations={suggestedDestinations}
        selectedIds={selectedIds}
        isOpen={isRecommendationOpen}
        onClose={() => setIsRecommendationOpen(false)}
        onAddToTrip={handleAddToTrip}
        onViewDetail={handleSelectDestination}
      />

      <DetailPanel
        destination={detailDestination}
        isSelected={isDetailSelected}
        onClose={() => {
          setDetailDestination(null);
          setFocusedId(null);
        }}
        onAddToTrip={handleAddToTrip}
        onRemoveFromTrip={handleRemoveFromTrip}
      />

      {/* ── Chat Dock ─────────────────────────────────────────────────────── */}
      <ChatDock
        tripParams={tripParams}
        onAIResponse={handleAIResponse}
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen((o) => !o)}
      />

      {/* ── Watermark ─────────────────────────────────────────────────────── */}
      <div className="fixed bottom-5 left-6 z-10 pointer-events-none">
        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/20">
          Atlas Cartographic · World Edition · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
