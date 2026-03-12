/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MapPin } from 'lucide-react';
import { sendChatMessage, ChatMessage, TripParams, AIResponse } from '../services/travelService';
import { Destination } from '../data/destinations';

interface AvatarChatProps {
  isOpen: boolean;
  onClose: () => void;
  /** Screen-space position of the avatar (px) */
  screenX: number;
  screenY: number;
  screenW: number;
  screenH: number;
  /** Current destination the avatar is at (null = floating at origin) */
  currentDestination: Destination | null;
  originName: string;
  tripParams: TripParams;
  onAIResponse: (response: AIResponse) => void;
}

const CHAT_W = 308;
const CHAT_H = 400;
const GAP = 30; // px gap from avatar center to chat edge

function parseBold(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold text-ink">{p}</strong> : p
  );
}

export const AvatarChat: React.FC<AvatarChatProps> = ({
  isOpen,
  onClose,
  screenX,
  screenY,
  screenW,
  screenH,
  currentDestination,
  originName,
  tripParams,
  onAIResponse,
}) => {
  const locationName = currentDestination
    ? `${currentDestination.name}, ${currentDestination.country}`
    : originName || 'the world';

  const greeting: ChatMessage = {
    role: 'assistant',
    content: currentDestination
      ? `I'm at **${currentDestination.name}** right now. Ask me anything about this destination — beaches, food, weather, what to do, or how to get around.`
      : `I'm your travel guide, ready to explore. Where would you like to go? Ask me for recommendations or tell me about your ideal trip.`,
    timestamp: new Date(),
  };

  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset conversation when destination changes
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: currentDestination
        ? `I'm at **${currentDestination.name}** right now. Ask me anything about this destination — beaches, food, weather, what to do, or how to get around.`
        : `I'm your travel guide, ready to explore. Where would you like to go?`,
      timestamp: new Date(),
    }]);
    setInput('');
  }, [currentDestination?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 200);
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.slice(-10);
      const locationPrefix = currentDestination
        ? `[Currently viewing: ${currentDestination.name}, ${currentDestination.country}. Region: ${currentDestination.region}. Tags: ${currentDestination.tags.join(', ')}]\n\n`
        : '';

      const response = await sendChatMessage(locationPrefix + text, history, tripParams);

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.assistantResponse, timestamp: new Date() },
      ]);
      onAIResponse(response);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Lost the signal for a moment. Try again?',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, currentDestination, tripParams, onAIResponse]);

  // Compute position — prefer right of avatar, flip left if overflow, clamp vertically
  const rawLeft = screenX + GAP;
  const flippedLeft = screenX - GAP - CHAT_W;
  const left = rawLeft + CHAT_W > screenW - 12 ? flippedLeft : rawLeft;
  const rawTop = screenY - CHAT_H / 2;
  const top = Math.max(12, Math.min(rawTop, screenH - CHAT_H - 12));

  // Tail side
  const tailOnLeft = left === rawLeft; // tail points left (bubble is to the right of avatar)

  const quickPrompts = currentDestination
    ? [
        `Best things to do in ${currentDestination.name}`,
        `Local food I must try`,
        `Best time of year to visit`,
        `How to get around`,
      ]
    : [
        'Recommend a beach destination',
        'Best places for adventure travel',
        'Romantic city for a couple',
        'Budget-friendly Asia trip',
      ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="avatar-chat"
          initial={{ opacity: 0, scale: 0.92, x: tailOnLeft ? -12 : 12 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.92, x: tailOnLeft ? -12 : 12 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'fixed', left, top, width: CHAT_W, zIndex: 55 }}
        >
          {/* Tail connector */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-0 h-0 ${
              tailOnLeft
                ? 'right-full border-t-6 border-b-6 border-r-6 border-t-transparent border-b-transparent border-r-parchment'
                : 'left-full border-t-6 border-b-6 border-l-6 border-t-transparent border-b-transparent border-l-parchment'
            }`}
            style={{ filter: 'drop-shadow(-1px 0 0 rgba(26,26,26,0.06))' }}
          />

          <div
            className="bg-parchment border border-ink/12 rounded-2xl overflow-hidden flex flex-col"
            style={{
              height: CHAT_H,
              boxShadow: '0 12px 48px rgba(26,26,26,0.2), 0 2px 0 rgba(26,26,26,0.05)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink/[0.07] bg-ink/[0.025] flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald/15 border border-emerald/35 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald" />
                </div>
                <div>
                  <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/40 block leading-none">
                    Atlas Guide
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={9} className="text-emerald" />
                    <span className="font-mono text-[9px] text-ink/60 leading-none">
                      {locationName}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-6 h-6 flex items-center justify-center text-ink/30 hover:text-ink/60 rounded-full hover:bg-ink/5 transition-all"
              >
                <X size={13} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 scrollbar-thin">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-5 h-5 rounded-full bg-emerald/15 border border-emerald/30 flex items-center justify-center flex-shrink-0 mt-0.5 mr-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald" />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] px-3 py-2 rounded-xl text-[12px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-ink text-parchment font-sans'
                        : 'bg-ink/[0.04] border border-ink/[0.07] text-ink/80 font-sans border-l-2 border-l-emerald/50'
                    }`}
                  >
                    {msg.role === 'assistant' ? parseBold(msg.content) : msg.content}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-emerald/15 border border-emerald/30 flex items-center justify-center flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald" />
                  </div>
                  <div className="flex items-center gap-1 px-3 py-2 bg-ink/[0.04] border border-ink/[0.07] rounded-xl border-l-2 border-l-emerald/50">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-ink/30"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Quick prompts (only when no real conversation yet) */}
            {messages.length === 1 && !isLoading && (
              <div className="px-3 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
                {quickPrompts.slice(0, 3).map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="text-[10px] font-mono px-2.5 py-1 rounded-full border border-ink/15 text-ink/50 hover:text-ink/75 hover:border-ink/25 transition-all truncate max-w-full"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Input bar */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-t border-ink/[0.07] flex-shrink-0">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={`Ask about ${currentDestination?.name ?? 'any destination'}…`}
                className="flex-1 bg-ink/[0.04] border border-ink/[0.08] rounded-lg px-3 py-1.5 text-[12px] font-sans text-ink placeholder:text-ink/30 focus:outline-none focus:border-emerald/40 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-7 h-7 rounded-lg bg-ink text-parchment flex items-center justify-center hover:bg-ink/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
