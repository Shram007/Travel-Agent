/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, SkipForward } from 'lucide-react';

// ─── Typewriter hook ─────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 22): string {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return displayed;
}

// ─── SVG Cursor element ───────────────────────────────────────────────────────
// Rendered INSIDE the D3 zoom <g> so it moves with the map.
interface AICursorSVGProps {
  projX: number;
  projY: number;
  k: number; // current zoom scale (to counter-scale cursor size)
}

export const AICursorSVG: React.FC<AICursorSVGProps> = ({ projX, projY, k }) => {
  const r = 14 / k;        // outer pulse radius
  const rMid = 8 / k;      // middle ring
  const dot = 3.5 / k;     // center dot
  const arm = 18 / k;      // crosshair arm length
  const armGap = 5 / k;    // gap before arm starts

  return (
    <motion.g
      animate={{ x: projX, y: projY }}
      transition={{
        x: { duration: 1.4, ease: [0.22, 1, 0.36, 1] },
        y: { duration: 1.4, ease: [0.22, 1, 0.36, 1] },
      }}
      style={{ pointerEvents: 'none' }}
    >
      {/* Outer pulsing ring */}
      <motion.circle
        r={r}
        fill="none"
        stroke="#2D7A5F"
        strokeWidth={1 / k}
        animate={{ r: [r, r * 1.9, r], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Second pulsing ring (offset phase) */}
      <motion.circle
        r={r * 0.7}
        fill="none"
        stroke="#2D7A5F"
        strokeWidth={0.8 / k}
        animate={{ r: [r * 0.7, r * 1.5, r * 0.7], opacity: [0.35, 0, 0.35] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
      />

      {/* Middle solid ring */}
      <circle r={rMid} fill="none" stroke="#2D7A5F" strokeWidth={1.2 / k} opacity={0.8} />

      {/* Crosshair arms — N, S, E, W */}
      {[0, 90, 180, 270].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = Math.cos(rad) * armGap;
        const y1 = Math.sin(rad) * armGap;
        const x2 = Math.cos(rad) * (armGap + arm);
        const y2 = Math.sin(rad) * (armGap + arm);
        return (
          <line
            key={deg}
            x1={x1} y1={y1}
            x2={x2} y2={y2}
            stroke="#2D7A5F"
            strokeWidth={1 / k}
            opacity={0.7}
            strokeLinecap="round"
          />
        );
      })}

      {/* Center dot */}
      <circle r={dot} fill="#F5F2ED" stroke="#2D7A5F" strokeWidth={1 / k} />

      {/* Inner dot */}
      <circle r={dot * 0.4} fill="#2D7A5F" />
    </motion.g>
  );
};

// ─── Narration bubble ────────────────────────────────────────────────────────
// Rendered as an HTML overlay, positioned using screen-space coordinates.
interface NarrationBubbleProps {
  narration: string;
  isVisible: boolean;
  screenX: number;
  screenY: number;
  screenW: number;
  screenH: number;
  stopIndex: number;      // 0-based
  totalStops: number;
  destinationName: string;
  onSkip: () => void;
}

export const NarrationBubble: React.FC<NarrationBubbleProps> = ({
  narration,
  isVisible,
  screenX,
  screenY,
  screenW,
  screenH,
  stopIndex,
  totalStops,
  destinationName,
  onSkip,
}) => {
  const displayed = useTypewriter(isVisible ? narration : '', 20);

  // Bubble is 320px wide, ~160px tall
  const BUBBLE_W = 336;
  const BUBBLE_H = 170;
  const OFFSET_Y = 46; // distance from cursor centre to bubble edge

  // Decide whether to place above or below the cursor
  const placeAbove = screenY > screenH * 0.55;
  const rawLeft = screenX - BUBBLE_W / 2;
  const rawTop = placeAbove ? screenY - BUBBLE_H - OFFSET_Y : screenY + OFFSET_Y;

  // Clamp to viewport
  const left = Math.max(12, Math.min(rawLeft, screenW - BUBBLE_W - 12));
  const top = Math.max(12, Math.min(rawTop, screenH - BUBBLE_H - 12));

  // Tail direction class
  const tailAbove = !placeAbove; // tail points up when bubble is below cursor

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key={`bubble-${stopIndex}`}
          initial={{ opacity: 0, scale: 0.92, y: placeAbove ? 8 : -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: placeAbove ? 8 : -8 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'fixed', left, top, width: BUBBLE_W, zIndex: 60 }}
        >
          {/* Tail pointer */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 ${
              tailAbove
                ? 'bottom-full border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-parchment'
                : 'top-full border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-parchment'
            }`}
            style={{ filter: 'drop-shadow(0 -1px 0 rgba(26,26,26,0.08))' }}
          />

          {/* Card */}
          <div
            className="bg-parchment border border-ink/10 shadow-2xl rounded-xl overflow-hidden"
            style={{ boxShadow: '0 8px 40px rgba(26,26,26,0.18), 0 1px 0 rgba(26,26,26,0.06)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink/[0.06] bg-ink/[0.02]">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, 20, -20, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
                >
                  <Sparkles size={12} className="text-emerald" />
                </motion.div>
                <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/50">
                  Atlas · Touring
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                {/* Stop counter */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalStops }).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-full transition-all duration-300 ${
                        i === stopIndex
                          ? 'w-3 h-1.5 bg-emerald'
                          : i < stopIndex
                          ? 'w-1.5 h-1.5 bg-ink/25'
                          : 'w-1.5 h-1.5 bg-ink/10'
                      }`}
                    />
                  ))}
                </div>
                {/* Skip button */}
                <button
                  onClick={onSkip}
                  className="flex items-center gap-1 text-ink/35 hover:text-ink/70 transition-colors"
                  title="Skip to next"
                >
                  <SkipForward size={12} />
                </button>
              </div>
            </div>

            {/* Destination name */}
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald flex-shrink-0" />
                <span className="font-serif text-sm font-semibold text-ink italic">
                  {destinationName}
                </span>
              </div>

              {/* Narration text with typewriter */}
              <p className="font-sans text-[12.5px] leading-relaxed text-ink/70 min-h-[3.5rem]">
                {displayed}
                {/* Blinking cursor while typing */}
                {displayed.length < narration.length && (
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.7, repeat: Infinity }}
                    className="inline-block w-0.5 h-3.5 bg-emerald ml-0.5 align-text-bottom"
                  />
                )}
              </p>
            </div>

            {/* Footer */}
            <div className="px-4 pb-3 pt-1 flex items-center justify-between">
              <span className="font-mono text-[8px] uppercase tracking-widest text-ink/25">
                {stopIndex + 1} of {totalStops}
              </span>
              <span className="font-mono text-[8px] text-ink/25">
                Press skip to advance →
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
