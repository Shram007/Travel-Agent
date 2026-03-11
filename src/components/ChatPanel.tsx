import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Send, Sparkles, X, MapPin } from 'lucide-react';
import {
  fetchChatSuggestions,
  Recommendation,
} from '../services/apiService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  recommendations?: Recommendation[];
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDestination: (recommendation: Recommendation) => void;
  activeLandmarkLabel?: string;
}

const QUICK_PROMPTS = [
  'Find cheap summer destinations from San Francisco',
  'Show architecture-rich cities in East Asia',
  'Best food + culture routes under a medium budget',
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  onSelectDestination,
  activeLandmarkLabel,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'I’m your Compass Companion. Tell me your travel vibe and I’ll light up options on the map.',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const canSend = useMemo(() => draft.trim().length > 0 && !isLoading, [draft, isLoading]);

  const sendPrompt = async (prompt: string) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedPrompt,
    };

    setMessages(prev => [...prev, userMessage]);
    setDraft('');
    setIsLoading(true);

    try {
      const result = await fetchChatSuggestions(trimmedPrompt);

      const recommendationLine = result.recommendations.length
        ? `I found ${result.recommendations.length} route ideas. Tap one below and I’ll guide the next step.`
        : 'I need one more hint—try adding budget, dates, or trip style.';

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `${recommendationLine}\n${result.followUpQuestion || ''}`.trim(),
        recommendations: result.recommendations,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content:
            error?.message || 'Companion connection interrupted. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          className="fixed top-0 right-0 h-full w-full md:w-[420px] bg-charcoal text-parchment z-[55] border-l border-parchment/10 shadow-2xl flex flex-col"
        >
          <div className="p-5 border-b border-parchment/10 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <motion.div
                animate={isLoading ? { y: [0, -3, 0] } : { y: 0 }}
                transition={{ repeat: isLoading ? Infinity : 0, duration: 1 }}
                className="w-11 h-11 rounded-full bg-parchment/10 border border-parchment/20 flex items-center justify-center text-xl"
                title="Compass Companion"
              >
                ⚡
              </motion.div>
              <div>
                <p className="font-serif text-lg italic">Compass Companion</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-parchment/50">
                  Interactive route guide
                </p>
                {activeLandmarkLabel && (
                  <p className="font-mono text-[10px] mt-2 text-parchment/60">
                    Focus: {activeLandmarkLabel}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-parchment/10 rounded-full transition-colors"
              title="Close companion"
            >
              <X size={16} />
            </button>
          </div>

          <div className="px-5 py-3 border-b border-parchment/10 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map(prompt => (
              <button
                key={prompt}
                disabled={isLoading}
                onClick={() => sendPrompt(prompt)}
                className="px-3 py-1.5 rounded-full border border-parchment/20 text-[10px] font-mono uppercase tracking-wide text-parchment/80 hover:bg-parchment/10 transition-colors disabled:opacity-40"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar archival-grain">
            {messages.map(message => (
              <div
                key={message.id}
                className={`space-y-2 ${message.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}
              >
                <div
                  className={`max-w-[90%] px-4 py-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-parchment text-charcoal'
                      : 'bg-parchment/10 border border-parchment/15 text-parchment'
                  }`}
                >
                  <p className="font-serif text-sm leading-relaxed whitespace-pre-line">
                    {message.content}
                  </p>
                </div>

                {message.recommendations && message.recommendations.length > 0 && (
                  <div className="w-full grid grid-cols-1 gap-2">
                    {message.recommendations.map((rec, index) => (
                      <button
                        key={`${message.id}-${rec.city}-${index}`}
                        onClick={() => onSelectDestination(rec)}
                        className="w-full text-left p-3 rounded-xl border border-parchment/20 bg-parchment/5 hover:bg-parchment/10 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-parchment/70" />
                          <span className="font-serif italic">
                            {rec.city}, {rec.country}
                          </span>
                        </div>
                        <p className="mt-1 font-serif text-xs text-parchment/75 leading-relaxed">
                          {rec.description}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-parchment/60 font-mono text-[10px] uppercase tracking-widest">
                <Loader2 size={12} className="animate-spin" />
                <span>Companion is scouting routes...</span>
              </div>
            )}
          </div>

          <form
            className="p-4 border-t border-parchment/10"
            onSubmit={e => {
              e.preventDefault();
              void sendPrompt(draft);
            }}
          >
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Ask for routes, vibes, or constraints..."
                className="flex-1 h-11 rounded-full bg-parchment/10 border border-parchment/20 px-4 text-sm font-serif placeholder:text-parchment/40 focus:outline-none focus:border-parchment/40"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="h-11 w-11 rounded-full bg-parchment text-charcoal flex items-center justify-center hover:bg-white transition-colors disabled:opacity-40"
                title="Send"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 text-parchment/40 font-mono text-[9px] uppercase tracking-widest">
              <Sparkles size={10} />
              <span>Tap recommendations to animate your map flow</span>
            </div>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
