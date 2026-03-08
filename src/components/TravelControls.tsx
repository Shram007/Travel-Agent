/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Calendar, DollarSign, Clock, Globe, Map, Plane } from 'lucide-react';
import { TripParams } from '../services/travelService';

type AppMode = 'explore' | 'build' | 'flight';

interface TravelControlsProps {
  params: TripParams;
  mode: AppMode;
  isOpen: boolean;
  onClose: () => void;
  onParamsChange: (params: Partial<TripParams>) => void;
  onModeChange: (mode: AppMode) => void;
}

const SEASONS = [
  { value: 'spring', label: 'Spring', icon: '🌸' },
  { value: 'summer', label: 'Summer', icon: '☀️' },
  { value: 'fall', label: 'Fall', icon: '🍂' },
  { value: 'winter', label: 'Winter', icon: '❄️' },
  { value: 'year-round', label: 'Any', icon: '🗓️' },
];

const MODES: Array<{ value: AppMode; label: string; icon: React.ReactNode; desc: string }> = [
  {
    value: 'explore',
    label: 'Explore',
    icon: <Globe size={14} />,
    desc: 'Discover destinations',
  },
  {
    value: 'build',
    label: 'Build',
    icon: <Map size={14} />,
    desc: 'Plan your route',
  },
  {
    value: 'flight',
    label: 'Flights',
    icon: <Plane size={14} />,
    desc: 'Visualise flight paths',
  },
];

function formatBudget(value: number): string {
  if (value >= 10000) return '$10,000+';
  return `$${value.toLocaleString()}`;
}

function budgetLabel(value: number): string {
  if (value < 1500) return 'budget';
  if (value < 4000) return 'moderate';
  if (value < 8000) return 'premium';
  return 'luxury';
}

export const TravelControls: React.FC<TravelControlsProps> = ({
  params,
  mode,
  isOpen,
  onClose,
  onParamsChange,
  onModeChange,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (mobile) */}
          <motion.div
            key="controls-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/10 backdrop-blur-[2px] z-40 md:hidden"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="controls-panel"
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="fixed left-0 top-0 h-full z-50 w-80 bg-parchment border-r border-ink/10 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-ink/[0.06]">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-ink/40">
                  Trip Parameters
                </p>
                <h2 className="text-lg font-serif font-semibold text-ink mt-0.5">
                  Configure Journey
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-ink/[0.04] hover:bg-ink/[0.08] flex items-center justify-center transition-colors"
              >
                <X size={15} className="text-ink/50" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

              {/* Mode switcher */}
              <div className="space-y-3">
                <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-ink/40">
                  Mode
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-ink/[0.04] rounded-xl">
                  {MODES.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => onModeChange(m.value)}
                      className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg text-center transition-all ${
                        mode === m.value
                          ? 'bg-ink text-parchment shadow-sm'
                          : 'text-ink/50 hover:text-ink hover:bg-ink/[0.04]'
                      }`}
                    >
                      {m.icon}
                      <span className="font-mono text-[8px] uppercase tracking-wider leading-none">
                        {m.label}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] font-sans text-ink/40 leading-snug">
                  {MODES.find((m) => m.value === mode)?.desc}
                </p>
              </div>

              {/* Origin */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink/40">
                  <MapPin size={11} />
                  Origin City
                </label>
                <input
                  type="text"
                  value={params.origin}
                  onChange={(e) => onParamsChange({ origin: e.target.value })}
                  placeholder="e.g. New York, London..."
                  className="w-full bg-ink/[0.03] border border-ink/10 rounded-lg px-4 py-2.5 font-sans text-sm text-ink placeholder-ink/25 outline-none focus:border-ink/25 focus:bg-ink/[0.05] transition-all"
                />
              </div>

              {/* Season */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink/40">
                  <Calendar size={11} />
                  Season
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {SEASONS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => onParamsChange({ season: s.value })}
                      className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-all border ${
                        params.season === s.value
                          ? 'border-ink/30 bg-ink/[0.06] text-ink'
                          : 'border-transparent text-ink/40 hover:text-ink/70 hover:border-ink/10'
                      }`}
                    >
                      <span className="text-base leading-none">{s.icon}</span>
                      <span className="font-mono text-[7px] uppercase tracking-wide leading-none">
                        {s.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink/40">
                  <DollarSign size={11} />
                  Total Budget
                </label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xl font-semibold text-ink">
                      {formatBudget(params.budget)}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-ink/40 bg-ink/[0.04] px-2 py-1 rounded">
                      {budgetLabel(params.budget)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={10000}
                    step={250}
                    value={params.budget}
                    onChange={(e) => onParamsChange({ budget: Number(e.target.value) })}
                    className="w-full accent-ink cursor-pointer h-1.5"
                  />
                  <div className="flex justify-between">
                    <span className="font-mono text-[8px] text-ink/25">$500</span>
                    <span className="font-mono text-[8px] text-ink/25">$10,000+</span>
                  </div>
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink/40">
                  <Clock size={11} />
                  Duration
                </label>
                <div className="space-y-2">
                  <div className="flex items-end gap-2">
                    <span className="font-mono text-xl font-semibold text-ink">
                      {params.duration}
                    </span>
                    <span className="font-mono text-sm text-ink/40 pb-0.5">
                      {params.duration === 1 ? 'day' : 'days'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    step={1}
                    value={params.duration}
                    onChange={(e) => onParamsChange({ duration: Number(e.target.value) })}
                    className="w-full accent-ink cursor-pointer h-1.5"
                  />
                  <div className="flex justify-between">
                    <span className="font-mono text-[8px] text-ink/25">1 day</span>
                    <span className="font-mono text-[8px] text-ink/25">30 days</span>
                  </div>
                </div>

                {/* Duration quick-select */}
                <div className="flex gap-1.5 flex-wrap">
                  {[3, 5, 7, 10, 14, 21].map((d) => (
                    <button
                      key={d}
                      onClick={() => onParamsChange({ duration: d })}
                      className={`font-mono text-[9px] px-2.5 py-1 rounded border transition-all ${
                        params.duration === d
                          ? 'bg-ink text-parchment border-ink'
                          : 'border-ink/15 text-ink/45 hover:border-ink/30 hover:text-ink/70'
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              {/* Archival summary */}
              <div className="rounded-xl bg-ink/[0.03] border border-ink/[0.06] p-4 space-y-2">
                <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/35">
                  Journey Summary
                </p>
                <div className="space-y-1">
                  {[
                    ['From', params.origin || 'Not set'],
                    ['Duration', `${params.duration} days`],
                    ['Budget', formatBudget(params.budget)],
                    ['Season', params.season],
                    ['Mode', mode],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="font-mono text-[9px] text-ink/35">{label}</span>
                      <span className="font-mono text-[10px] text-ink/65 capitalize">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer decoration */}
            <div className="px-6 py-4 border-t border-ink/[0.06]">
              <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/25 text-center">
                Atlas · The Modern Traveler's Companion
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
