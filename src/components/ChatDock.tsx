/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, ChevronDown, Sparkles, Loader2, X, Lightbulb } from 'lucide-react';
import { ChatMessage, TripParams, AIResponse, sendChatMessage, getQuickSuggestions, AVAILABLE_GEMINI_MODELS, AVAILABLE_GMI_MODELS, fetchGmiModels } from '../services/travelService';

interface ChatDockProps {
  tripParams: TripParams;
  onAIResponse: (response: AIResponse) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const ChatDock: React.FC<ChatDockProps> = ({
  tripParams,
  onAIResponse,
  isOpen,
  onToggle,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Welcome to **Atlas**. I'm your AI travel companion — tell me where you dream of going, what your budget is, or ask me to build an itinerary. I can suggest destinations, highlight them on the map, and help you plan the journey of a lifetime.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestions = getQuickSuggestions();
  const [selectedModel, setSelectedModel] = useState<string>(AVAILABLE_GEMINI_MODELS[0]);
  const [gmiModels, setGmiModels] = useState<string[]>(AVAILABLE_GMI_MODELS);

  // Fetch authoritative GMI model list from backend on mount
  useEffect(() => {
    fetchGmiModels().then(setGmiModels);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || isThinking) return;

      const userMessage: ChatMessage = {
        role: 'user',
        content: msg,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsThinking(true);
      setShowSuggestions(false);

      try {
        const response = await sendChatMessage(msg, messages, tripParams, selectedModel);
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.assistantResponse,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        onAIResponse(response);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'The map signal was temporarily lost. Try again in a moment.',
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [input, messages, isThinking, tripParams, onAIResponse, selectedModel]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  function formatContent(text: string): React.ReactNode {
    // Simple bold parser: **text** → <strong>
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/20 backdrop-blur-[2px] z-30 md:hidden"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      {/* Chat dock */}
      <motion.div
        layout
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4 md:px-0"
        style={{ originY: 1 }}
      >
        <motion.div
          layout
          className="bg-parchment border border-ink/10 shadow-2xl rounded-t-2xl overflow-hidden"
          style={{
            boxShadow: '0 -4px 40px rgba(26,26,26,0.12), 0 -1px 0 rgba(26,26,26,0.06)',
          }}
        >
          {/* Header / collapsed bar */}
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-ink/[0.02] transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-ink rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles size={13} className="text-parchment" />
              </div>
              <div className="text-left">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
                  Atlas AI
                </p>
                {!isOpen && (
                  <p className="text-sm text-ink/60 font-sans leading-tight mt-0.5">
                    Ask me to plan your next adventure...
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isThinking && (
                <Loader2 size={14} className="animate-spin text-emerald" />
              )}
              <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
                <ChevronDown size={16} className="text-ink/40 group-hover:text-ink/60 transition-colors" />
              </motion.div>
            </div>
          </button>

          {/* Expanded chat area */}
          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.div
                key="chat-body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: 'hidden' }}
              >
                {/* Messages */}
                <div
                  className="h-72 md:h-80 overflow-y-auto px-5 py-4 space-y-4 scroll-smooth"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(26,26,26,0.1) transparent' }}
                >
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.05 }}
                      className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {/* Avatar */}
                      {msg.role === 'assistant' && (
                        <div className="w-6 h-6 bg-ink rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Sparkles size={10} className="text-parchment" />
                        </div>
                      )}

                      {/* Bubble */}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-ink text-parchment rounded-tr-sm font-sans'
                            : 'bg-ink/[0.04] text-ink rounded-tl-sm font-sans border border-ink/[0.06]'
                        }`}
                      >
                        {msg.role === 'assistant' ? formatContent(msg.content) : msg.content}
                        <p className={`text-[9px] mt-1.5 font-mono tracking-wide ${msg.role === 'user' ? 'text-parchment/40 text-right' : 'text-ink/30'}`}>
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </motion.div>
                  ))}

                  {/* Thinking indicator */}
                  {isThinking && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3"
                    >
                      <div className="w-6 h-6 bg-ink rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles size={10} className="text-parchment" />
                      </div>
                      <div className="bg-ink/[0.04] border border-ink/[0.06] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                        {[0, 1, 2].map((dot) => (
                          <motion.div
                            key={dot}
                            className="w-1.5 h-1.5 bg-ink/40 rounded-full"
                            animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              delay: dot * 0.18,
                              ease: 'easeInOut',
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick suggestions */}
                <AnimatePresence>
                  {showSuggestions && (
                    <motion.div
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-5 pb-3"
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <Lightbulb size={11} className="text-ink/30" />
                        <span className="font-mono text-[8px] uppercase tracking-widest text-ink/30">
                          Try asking
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.slice(0, 4).map((s) => (
                          <button
                            key={s}
                            onClick={() => handleSend(s)}
                            className="text-[11px] font-sans text-ink/60 bg-ink/[0.04] hover:bg-ink/[0.08] border border-ink/[0.08] rounded-full px-3 py-1.5 transition-colors text-left leading-tight"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Divider */}
                <div className="h-px bg-ink/[0.06] mx-5" />

                {/* Input area */}
                <div className="px-5 py-3 flex items-end gap-3">
                  <div className="flex-1">
                    <div className="mb-1.5">
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        disabled={isThinking}
                        className="w-full md:w-auto bg-ink/[0.04] border border-ink/[0.08] rounded-md px-2 py-1 text-[11px] font-mono text-ink/70 outline-none disabled:opacity-50"
                      >
                        <optgroup label="Gemini (Google)">
                          {AVAILABLE_GEMINI_MODELS.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="GMI Cloud">
                          {gmiModels.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask Atlas anything about travel..."
                      rows={1}
                      disabled={isThinking}
                      className="w-full resize-none bg-transparent font-sans text-sm text-ink placeholder-ink/30 outline-none leading-relaxed py-1"
                      style={{ minHeight: '24px', maxHeight: '120px' }}
                    />
                  </div>
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isThinking}
                    className="w-9 h-9 bg-ink rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-30 hover:bg-ink/80 transition-all active:scale-95"
                  >
                    <Send size={14} className="text-parchment" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </>
  );
};
