/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  MapPin,
  DollarSign,
  Calendar,
  Compass,
  Tag,
  Plane,
} from 'lucide-react';
import { Destination } from '../data/destinations';

interface DetailPanelProps {
  destination: Destination | null;
  isSelected: boolean;
  onClose: () => void;
  onAddToTrip: (dest: Destination) => void;
  onRemoveFromTrip: (id: string) => void;
}

const BUDGET_LABEL: Record<string, string> = {
  budget: 'Budget-Friendly',
  moderate: 'Moderate',
  luxury: 'Luxury',
};

const BUDGET_COLOR: Record<string, string> = {
  budget: 'text-green-600 bg-green-50 border-green-100',
  moderate: 'text-amber-600 bg-amber-50 border-amber-100',
  luxury: 'text-purple-600 bg-purple-50 border-purple-100',
};

const REGION_COLOR: Record<string, string> = {
  Europe: 'text-blue-600',
  Asia: 'text-amber-600',
  Americas: 'text-green-600',
  Africa: 'text-orange-600',
  Oceania: 'text-purple-600',
};

function flightTimeLabel(hours: number): string {
  if (hours === 0) return 'Origin (New York)';
  if (hours < 1) return `< 1 hr from NY`;
  return `~${hours} hrs from NY`;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({
  destination,
  isSelected,
  onClose,
  onAddToTrip,
  onRemoveFromTrip,
}) => {
  const dest = destination;

  return (
    <AnimatePresence>
      {dest && (
        <motion.div
          key={dest.id}
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          className="fixed right-0 top-0 h-full z-50 w-full max-w-sm bg-parchment border-l border-ink/10 shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="relative px-6 pt-8 pb-6 border-b border-ink/[0.06] flex-shrink-0">
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-ink/[0.04] hover:bg-ink/[0.08] flex items-center justify-center transition-colors"
            >
              <X size={15} className="text-ink/50" />
            </button>

            {/* Region tag */}
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-ink/35">
                Destination Record
              </span>
              <div className="h-px flex-1 bg-ink/[0.06]" />
              <span
                className={`font-mono text-[8px] uppercase tracking-wide font-semibold ${
                  REGION_COLOR[dest.region] ?? 'text-ink/40'
                }`}
              >
                {dest.region}
              </span>
            </div>

            {/* Name */}
            <h1 className="font-serif text-3xl font-bold text-ink leading-tight">{dest.name}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <MapPin size={12} className="text-ink/40 flex-shrink-0" />
              <span className="font-mono text-[10px] text-ink/45">{dest.country}</span>
              <span className="font-mono text-[10px] text-ink/25">·</span>
              <span className="font-mono text-[10px] text-ink/45 tracking-wide">
                {dest.coordinates}
              </span>
            </div>
          </div>

          {/* Scrollable body */}
          <div
            className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(26,26,26,0.08) transparent' }}
          >
            {/* Description */}
            <div className="space-y-2">
              <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/35">
                About
              </p>
              <p className="font-serif text-base leading-relaxed text-ink/75 italic">
                {dest.description}
              </p>
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  icon: <DollarSign size={12} />,
                  label: 'Budget Level',
                  value: BUDGET_LABEL[dest.estimatedBudgetLevel],
                  extra: (
                    <span
                      className={`inline-block font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 rounded border mt-1 ${
                        BUDGET_COLOR[dest.estimatedBudgetLevel] ?? ''
                      }`}
                    >
                      {dest.estimatedBudgetLevel}
                    </span>
                  ),
                },
                {
                  icon: <Calendar size={12} />,
                  label: 'Best Season',
                  value: dest.bestSeason,
                },
                {
                  icon: <Plane size={12} />,
                  label: 'Flight Time',
                  value: flightTimeLabel(dest.flightHoursFromNY),
                },
                {
                  icon: <Compass size={12} />,
                  label: 'Region',
                  value: dest.region,
                },
              ].map(({ icon, label, value, extra }) => (
                <div
                  key={label}
                  className="bg-ink/[0.03] border border-ink/[0.06] rounded-xl p-3 space-y-1"
                >
                  <div className="flex items-center gap-1.5 text-ink/35">
                    {icon}
                    <span className="font-mono text-[8px] uppercase tracking-wider">{label}</span>
                  </div>
                  <p className="font-sans text-[12px] font-medium text-ink/70 leading-tight">
                    {value}
                  </p>
                  {extra}
                </div>
              ))}
            </div>

            {/* Budget estimates */}
            <div className="space-y-2">
              <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/35">
                Avg. Daily Budget (USD)
              </p>
              <div className="space-y-1.5">
                {(
                  [
                    ['budget', 'Budget Traveler', dest.avgDailyBudget.budget],
                    ['moderate', 'Comfort Traveler', dest.avgDailyBudget.moderate],
                    ['luxury', 'Luxury Traveler', dest.avgDailyBudget.luxury],
                  ] as const
                ).map(([level, label, amount]) => (
                  <div key={level} className="flex items-center justify-between">
                    <span className="font-sans text-[11px] text-ink/55">{label}</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1 rounded-full bg-ink/10"
                        style={{
                          width: `${Math.min(100, (amount / dest.avgDailyBudget.luxury) * 70)}px`,
                        }}
                      >
                        <div
                          className="h-full rounded-full bg-ink/30"
                          style={{
                            width: `${(amount / dest.avgDailyBudget.luxury) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-ink/60 w-14 text-right">
                        ${amount}/day
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Archival metadata */}
            <div className="rounded-xl bg-ink/[0.03] border border-ink/[0.06] p-4 space-y-3">
              <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/35">
                Archival Record
              </p>
              <div className="space-y-2">
                {[
                  ['Architectural Era', dest.architecturalEra],
                  ['Architectural Type', dest.architecturalType],
                  ['Country', dest.country],
                  ['Coordinates', dest.coordinates],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4">
                    <span className="font-mono text-[8px] uppercase tracking-wide text-ink/30 flex-shrink-0">
                      {label}
                    </span>
                    <span className="font-mono text-[9px] text-ink/60 text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-ink/35">
                <Tag size={10} />
                <span className="font-mono text-[8px] uppercase tracking-[0.2em]">Tags</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dest.tags.map((tag) => (
                  <span
                    key={tag}
                    className="font-mono text-[8px] uppercase tracking-wide text-ink/45 bg-ink/[0.04] border border-ink/[0.07] px-2.5 py-1 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="px-6 py-4 border-t border-ink/[0.06] flex-shrink-0">
            {isSelected ? (
              <button
                onClick={() => onRemoveFromTrip(dest.id)}
                className="w-full py-3 flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-all font-mono text-[10px] uppercase tracking-widest"
              >
                <X size={13} />
                Remove from Trip
              </button>
            ) : (
              <button
                onClick={() => onAddToTrip(dest)}
                className="w-full py-3 flex items-center justify-center gap-2 rounded-xl bg-ink text-parchment hover:bg-ink/85 transition-all font-mono text-[10px] uppercase tracking-widest"
              >
                <Plus size={13} />
                Add to Trip
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
