/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Calendar } from 'lucide-react';

interface TimelineProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ selectedYear, onYearChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState(selectedYear.toString());
  const [isDragging, setIsDragging] = useState(false);
  const minYear = 1200;
  const maxYear = 1950;

  useEffect(() => {
    setInputValue(selectedYear.toString());
  }, [selectedYear]);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const year = Math.round(minYear + percentage * (maxYear - minYear));
    
    if (year !== selectedYear) {
      onYearChange(year);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMouseMove(e);
    
    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleMouseMove(e);
    
    const handleTouchEnd = () => {
      setIsDragging(false);
      window.removeEventListener('touchend', handleTouchEnd);
    };
    window.addEventListener('touchend', handleTouchEnd);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const year = parseInt(inputValue);
    if (!isNaN(year)) {
      const clampedYear = Math.max(minYear, Math.min(maxYear, year));
      onYearChange(clampedYear);
      setInputValue(clampedYear.toString());
    }
  };

  const markers = [1200, 1350, 1500, 1650, 1800, 1950];
  const progress = ((selectedYear - minYear) / (maxYear - minYear)) * 100;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="bg-parchment border-t border-charcoal/10 shadow-[0_-4px_20px_rgb(0,0,0,0.05)] py-4 px-6 archival-grain flex flex-col gap-2">
        {/* Top Bar: Year Input and Labels */}
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-charcoal/40">
              <Calendar size={14} />
              <span className="font-mono text-[10px] uppercase tracking-widest">Archive Path</span>
            </div>
            <div className="h-4 w-[1px] bg-charcoal/10" />
            <form onSubmit={handleInputSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputSubmit}
                className="w-16 bg-transparent border-b border-charcoal/20 font-mono text-sm text-charcoal focus:outline-none focus:border-charcoal transition-colors text-center"
              />
              <span className="font-mono text-[10px] text-charcoal/40 uppercase">AD</span>
            </form>
          </div>

          <div className="flex gap-8">
            {markers.map(m => {
              const isActive = Math.abs(selectedYear - m) < 100;
              return (
                <button
                  key={m}
                  onClick={() => onYearChange(m)}
                  className={`font-mono text-[10px] tracking-tighter transition-all duration-300 ${
                    isActive ? 'text-charcoal font-bold scale-110' : 'text-charcoal/30 hover:text-charcoal/60'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline Slider Area */}
        <div className="max-w-7xl mx-auto w-full">
          <div 
            ref={containerRef}
            className="relative h-6 flex items-center cursor-crosshair group px-2"
            onMouseMove={(e) => e.buttons === 1 && handleMouseMove(e)}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleMouseMove}
          >
            {/* Track */}
            <div className="absolute inset-x-2 h-[2px] bg-charcoal/10 rounded-full" />
            
            {/* Highlighted Track - Textured ink line */}
            <motion.div 
              className="absolute left-2 h-[2px] bg-charcoal/60 origin-left rounded-full"
              style={{ 
                backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.1) 50%, transparent 100%)',
                backgroundSize: '4px 100%'
              }}
              animate={{ width: `calc(${progress}% - 8px)` }}
              transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
            />
            
            {/* Ticks - Memoized for performance */}
            <div className="absolute inset-x-2 h-3 flex justify-between items-center">
              {React.useMemo(() => Array.from({ length: 101 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`w-[1px] transition-colors duration-300 ${
                    i % 10 === 0 ? 'h-3 bg-charcoal/30' : 'h-1.5 bg-charcoal/10'
                  }`} 
                />
              )), [])}
            </div>

            {/* Scrubber - Gun-sight / Antique Navigation Instrument */}
            <motion.div 
              className="absolute top-0 bottom-0 w-[1px] z-10"
              animate={{ left: `${progress}%` }}
              transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
            >
              {/* Vertical Sight Line */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-charcoal/40" />
              
              <motion.div 
                className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 flex items-center justify-center"
                animate={{ 
                  scale: isDragging ? 1.4 : 1,
                  rotate: isDragging ? 90 : 0,
                  filter: isDragging ? 'drop-shadow(0 0 8px rgba(26, 26, 26, 0.4))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                }}
                transition={{ duration: 0.3, ease: "anticipate" }}
              >
                {/* Antique Sight SVG - Perfectly Balanced Design */}
                <svg width="40" height="40" viewBox="0 0 40 40" className="text-charcoal">
                  {/* Outer Ring - Hollow but filled with parchment to "cut through" */}
                  <circle cx="20" cy="20" r="10" stroke="currentColor" strokeWidth="1.5" fill="#F4E4BC" />
                  
                  {/* Crosshairs - Faint */}
                  <line x1="20" y1="10" x2="20" y2="30" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 1" opacity="0.4" />
                  <line x1="10" y1="20" x2="30" y2="20" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 1" opacity="0.4" />
                  
                  {/* Extended Precision Ticks (Balanced on all 4 sides) */}
                  <path d="M20 0 L20 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M20 30 L20 40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M0 20 L10 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M30 20 L40 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  
                  {/* Decorative Archival Rivets - Repositioned for balance */}
                  <circle cx="20" cy="15" r="0.8" fill="currentColor" />
                  <circle cx="20" cy="25" r="0.8" fill="currentColor" />
                  <circle cx="15" cy="20" r="0.8" fill="currentColor" />
                  <circle cx="25" cy="20" r="0.8" fill="currentColor" />
                </svg>

                {isDragging && (
                  <motion.div 
                    className="absolute inset-0 border-2 border-charcoal/10 rounded-full"
                    animate={{ scale: [1, 2.5], opacity: [0.3, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                  />
                )}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};
