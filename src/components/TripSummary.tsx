/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Trash2, ArrowRight, Clock, DollarSign, Globe } from 'lucide-react';
import { Destination } from '../data/destinations';
import { TripParams } from '../services/travelService';

interface TripSummaryProps {
  selectedDestinations: Destination[];
  params: TripParams;
  isOpen: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
  onSelectDestination: (dest: Destination) => void;
}

// Approximate great-circle distance in km between two lat/lon points
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatKm(km: number): string {
  if (km >= 10000) return `${(km / 1000).toFixed(0)}k km`;
  if (km >= 1000) return `${(km / 1000).toFixed(1)}k km`;
  return `${km.toFixed(0)} km`;
}

const REGION_COLORS: Record<string, string> = {
  Europe: 'bg-blue-100 text-blue-700',
  Asia: 'bg-amber-100 text-amber-700',
  Americas: 'bg-green-100 text-green-700',
  Africa: 'bg-orange-100 text-orange-700',
  Oceania: 'bg-purple-100 text-purple-700',
};

export const TripSummary: React.FC<TripSummaryProps> = ({
  selectedDestinations,
  params,
  isOpen,
  onClose,
  onRemove,
  onSelectDestination,
}) => {
  const totalDistance = useMemo(() => {
    if (selectedDestinations.length < 2) return 0;
    let dist = 0;
    for (let i = 0; i < selectedDestinations.length - 1; i++) {
      const a = selectedDestinations[i];
      const b = selectedDestinations[i + 1];
      dist += haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
    }
    return dist;
  }, [selectedDestinations]);

  const regionsVisited = useMemo(() => {
    const set = new Set(selectedDestinations.map((d) => d.region));
    return Array.from(set);
  }, [selectedDestinations]);

  const daysPerStop = selectedDestinations.length > 0
    ? Math.max(1, Math.floor(params.duration / selectedDestinations.length))
    : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (mobile) */}
          <motion.div
            key="summary-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/10 z-40 md:hidden"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="summary-panel"
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="fixed right-0 top-0 h-full z-50 w-80 bg-parchment border-l border-ink/10 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-ink/[0.06]">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-ink/40">
                  Itinerary
                </p>
                <h2 className="text-lg font-serif font-semibold text-ink mt-0.5">
                  {selectedDestinations.length === 0
                    ? 'No Stops Yet'
                    : `${selectedDestinations.length} Stop${selectedDestinations.length !== 1 ? 's' : ''}`}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-ink/[0.04] hover:bg-ink/[0.08] flex items-center justify-center transition-colors"
              >
                <X size={15} className="text-ink/50" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {selectedDestinations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-ink/[0.04] flex items-center justify-center">
                    <MapPin size={22} className="text-ink/20" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-serif text-base text-ink/40 italic">
                      No destinations selected
                    </p>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-ink/25">
                      Click markers on the map or ask Atlas
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Route stats */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        icon: <Globe size={12} />,
                        label: 'Regions',
                        value: regionsVisited.length.toString(),
                      },
                      {
                        icon: <MapPin size={12} />,
                        label: 'Distance',
                        value: formatKm(totalDistance),
                      },
                      {
                        icon: <Clock size={12} />,
                        label: 'Days/Stop',
                        value: `~${daysPerStop}d`,
                      },
                      {
                        icon: <DollarSign size={12} />,
                        label: 'Budget',
                        value: `$${params.budget.toLocaleString()}`,
                      },
                    ].map(({ icon, label, value }) => (
                      <div
                        key={label}
                        className="bg-ink/[0.03] border border-ink/[0.06] rounded-xl p-3 space-y-1"
                      >
                        <div className="flex items-center gap-1.5 text-ink/40">
                          {icon}
                          <span className="font-mono text-[8px] uppercase tracking-widest">
                            {label}
                          </span>
                        </div>
                        <p className="font-mono text-sm font-semibold text-ink">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Destinations list */}
                  <div className="space-y-2">
                    <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/35">
                      Route Order
                    </p>
                    <div className="space-y-1">
                      {selectedDestinations.map((dest, i) => (
                        <React.Fragment key={dest.id}>
                          <motion.div
                            layout
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="group flex items-center gap-3 p-3 rounded-xl bg-ink/[0.02] border border-ink/[0.05] hover:border-ink/[0.12] hover:bg-ink/[0.04] transition-all cursor-pointer"
                            onClick={() => onSelectDestination(dest)}
                          >
                            {/* Number */}
                            <div className="w-6 h-6 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center flex-shrink-0">
                              <span className="font-mono text-[9px] font-bold text-gold-dark">
                                {i + 1}
                              </span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-sans text-sm font-medium text-ink truncate">
                                {dest.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-[8px] text-ink/40">
                                  {dest.country}
                                </span>
                                <span
                                  className={`font-mono text-[7px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                    REGION_COLORS[dest.region] ?? 'bg-ink/5 text-ink/40'
                                  }`}
                                >
                                  {dest.region}
                                </span>
                              </div>
                            </div>

                            {/* Remove */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemove(dest.id);
                              }}
                              className="w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-100 flex items-center justify-center transition-all"
                            >
                              <Trash2 size={11} className="text-red-400" />
                            </button>
                          </motion.div>

                          {/* Arrow connector */}
                          {i < selectedDestinations.length - 1 && (
                            <div className="flex items-center justify-center py-0.5">
                              <div className="flex items-center gap-2 text-ink/20">
                                <div className="h-px w-8 bg-ink/10" />
                                <ArrowRight size={11} />
                                <div className="h-px w-8 bg-ink/10" />
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Regions visited */}
                  {regionsVisited.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/35">
                        Regions Covered
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {regionsVisited.map((r) => (
                          <span
                            key={r}
                            className={`font-mono text-[8px] uppercase tracking-wider px-2 py-1 rounded ${
                              REGION_COLORS[r] ?? 'bg-ink/5 text-ink/50'
                            }`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Per-stop days breakdown */}
                  <div className="rounded-xl bg-ink/[0.03] border border-ink/[0.06] p-4 space-y-3">
                    <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/35">
                      {params.duration}-Day Breakdown
                    </p>
                    <div className="space-y-1.5">
                      {selectedDestinations.map((dest, i) => {
                        const days = i === selectedDestinations.length - 1
                          ? params.duration - daysPerStop * (selectedDestinations.length - 1)
                          : daysPerStop;
                        return (
                          <div key={dest.id} className="flex items-center justify-between">
                            <span className="font-sans text-[11px] text-ink/60 truncate max-w-[160px]">
                              {dest.name}
                            </span>
                            <span className="font-mono text-[9px] text-ink/50">
                              {Math.max(1, days)} days
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {selectedDestinations.length > 0 && (
              <div className="px-6 py-4 border-t border-ink/[0.06]">
                <button
                  onClick={() => onRemove('__clear_all__')}
                  className="w-full py-2.5 font-mono text-[9px] uppercase tracking-widest text-ink/40 hover:text-red-500 border border-ink/[0.08] hover:border-red-200 rounded-lg transition-all"
                >
                  Clear All Stops
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
