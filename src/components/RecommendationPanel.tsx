/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Check, MapPin, Tag, Leaf } from 'lucide-react';
import { Destination } from '../data/destinations';

interface RecommendationPanelProps {
  suggestedDestinations: Destination[];
  selectedIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onAddToTrip: (dest: Destination) => void;
  onViewDetail: (dest: Destination) => void;
}

const BUDGET_ICONS: Record<string, string> = {
  budget: '$',
  moderate: '$$',
  luxury: '$$$',
};

const REGION_BADGE: Record<string, string> = {
  Europe: 'bg-blue-50 text-blue-600 border-blue-100',
  Asia: 'bg-amber-50 text-amber-600 border-amber-100',
  Americas: 'bg-green-50 text-green-600 border-green-100',
  Africa: 'bg-orange-50 text-orange-600 border-orange-100',
  Oceania: 'bg-purple-50 text-purple-600 border-purple-100',
};

export const RecommendationPanel: React.FC<RecommendationPanelProps> = ({
  suggestedDestinations,
  selectedIds,
  isOpen,
  onClose,
  onAddToTrip,
  onViewDetail,
}) => {
  return (
    <AnimatePresence>
      {isOpen && suggestedDestinations.length > 0 && (
        <motion.div
          key="rec-panel"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          className="fixed left-0 right-0 bottom-0 z-30 md:left-auto md:right-6 md:bottom-28 md:w-96 md:rounded-2xl bg-parchment border border-ink/10 shadow-2xl overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink/[0.06] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald/10 border border-emerald/20 flex items-center justify-center">
                <Leaf size={13} className="text-emerald" />
              </div>
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/40">
                  Atlas Recommends
                </p>
                <p className="font-sans text-sm font-medium text-ink">
                  {suggestedDestinations.length} Suggested{' '}
                  {suggestedDestinations.length === 1 ? 'Destination' : 'Destinations'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-ink/[0.04] hover:bg-ink/[0.08] flex items-center justify-center transition-colors"
            >
              <X size={14} className="text-ink/50" />
            </button>
          </div>

          {/* Destination cards */}
          <div
            className="overflow-y-auto flex-1 px-4 py-4 space-y-3"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(26,26,26,0.1) transparent' }}
          >
            {suggestedDestinations.map((dest, i) => {
              const isAdded = selectedIds.includes(dest.id);

              return (
                <motion.div
                  key={dest.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="group relative rounded-xl border border-ink/[0.07] bg-ink/[0.015] hover:border-ink/[0.15] hover:bg-ink/[0.035] transition-all overflow-hidden cursor-pointer"
                  onClick={() => onViewDetail(dest)}
                >
                  {/* Content */}
                  <div className="p-4 space-y-3">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-serif text-base font-semibold text-ink leading-tight">
                            {dest.name}
                          </h3>
                          <span
                            className={`font-mono text-[7px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                              REGION_BADGE[dest.region] ?? 'bg-ink/5 text-ink/40 border-ink/10'
                            }`}
                          >
                            {dest.region}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-ink/40">
                          <MapPin size={10} />
                          <span className="font-mono text-[9px]">{dest.country}</span>
                          <span className="font-mono text-[9px]">·</span>
                          <span className="font-mono text-[9px]">
                            {BUDGET_ICONS[dest.estimatedBudgetLevel]}
                          </span>
                          <span className="font-mono text-[9px]">·</span>
                          <span className="font-mono text-[9px]">{dest.bestSeason}</span>
                        </div>
                      </div>

                      {/* Add button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToTrip(dest);
                        }}
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          isAdded
                            ? 'bg-gold/20 border border-gold/40 text-gold-dark'
                            : 'bg-ink/[0.06] border border-ink/[0.08] text-ink/50 hover:bg-emerald/10 hover:border-emerald/30 hover:text-emerald'
                        }`}
                        title={isAdded ? 'Added to trip' : 'Add to trip'}
                      >
                        {isAdded ? <Check size={13} /> : <Plus size={13} />}
                      </button>
                    </div>

                    {/* Description */}
                    <p className="font-sans text-[12px] text-ink/55 leading-relaxed line-clamp-2">
                      {dest.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {dest.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="font-mono text-[8px] uppercase tracking-wide text-ink/35 bg-ink/[0.04] px-2 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Coordinates */}
                    <p className="font-mono text-[8px] text-ink/25 tracking-wider">
                      {dest.coordinates}
                    </p>
                  </div>

                  {/* Left accent bar for added */}
                  {isAdded && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gold" />
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-ink/[0.06] flex-shrink-0">
            <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/25 text-center">
              Click any card to view full details · Green markers on map
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
