/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Info, Map as MapIcon, Layers, Clock, X } from 'lucide-react';

interface ReferencePanelProps {
  totalLandmarks: number;
  visibleInEra: number;
  visibleInView: number;
  currentYear: number;
  onClose: () => void;
}

export const ReferencePanel: React.FC<ReferencePanelProps> = ({
  totalLandmarks,
  visibleInEra,
  visibleInView,
  currentYear,
  onClose
}) => {
  return (
    <div className="fixed top-8 right-24 z-30 pointer-events-none">
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="bg-parchment/95 backdrop-blur-md border border-charcoal/20 p-8 rounded-2xl shadow-2xl archival-grain w-80 pointer-events-auto relative"
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-charcoal/5 rounded-full transition-colors text-charcoal/40 hover:text-charcoal"
        >
          <X size={16} />
        </button>

        {/* Title Section */}
        <div className="mb-8 border-b border-charcoal/10 pb-4">
          <h1 className="text-2xl font-serif font-bold tracking-tight text-charcoal/90 uppercase leading-none">
            Archival Atlas
          </h1>
          <p className="font-mono text-[8px] uppercase tracking-[0.2em] mt-2 text-charcoal/40">
            Index of Historical Records
          </p>
        </div>

        {/* Legend Section */}
        <div className="space-y-6 mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers size={12} className="text-charcoal/30" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-charcoal/40">Marker Legend</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full border border-charcoal bg-charcoal mt-1" />
              <div className="space-y-1">
                <p className="font-serif text-xs font-bold italic">Geographic Anchor</p>
                <p className="font-serif text-[10px] text-charcoal/60 leading-tight">Precise location of the architectural landmark as verified by archival registries.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Region Guide */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-2">
            <MapIcon size={12} className="text-charcoal/30" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-charcoal/40">Regional Distribution</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-serif text-[11px] text-charcoal/70">
            {['Europe', 'MENA', 'Africa', 'South Asia', 'East Asia', 'Americas', 'Oceania'].map(region => (
              <div key={region} className="flex items-center gap-2">
                <div className="w-1 h-1 bg-charcoal/30 rounded-full" />
                <span>{region}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Counts */}
        <div className="space-y-3 pt-6 border-t border-charcoal/10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Layers size={12} className="text-charcoal/30" />
              <span className="font-serif text-[11px] italic">Total in Archive</span>
            </div>
            <span className="font-mono text-[11px] font-bold">{totalLandmarks}</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Clock size={12} className="text-charcoal/30" />
              <span className="font-serif text-[11px] italic">Visible in Era</span>
            </div>
            <span className="font-mono text-[11px] font-bold">{visibleInEra}</span>
          </div>
          <div className="flex justify-between items-center bg-charcoal/5 -mx-4 px-4 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <MapIcon size={12} className="text-charcoal/30" />
              <span className="font-serif text-[11px] italic">Visible in View</span>
            </div>
            <span className="font-mono text-[11px] font-bold">{visibleInView}</span>
          </div>
        </div>

        <div className="mt-8 text-center pt-4 border-t border-charcoal/5">
          <p className="font-mono text-[8px] text-charcoal/30 uppercase tracking-[0.2em]">
            Data accurate to {currentYear} AD
          </p>
          <p className="font-serif text-[9px] text-charcoal/40 italic mt-1">
            Archival Atlas Museum // Global Repository
          </p>
        </div>
      </motion.div>
    </div>
  );
};
