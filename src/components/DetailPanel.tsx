/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Key, Info, ChevronRight } from 'lucide-react';
import { Landmark } from '../data/landmarks';
import { GoogleGenAI, Type } from "@google/genai";

interface ArchitecturalMetadata {
  location: {
    country: string;
    cityRegion: string;
    geographicRegion: string;
  };
  period: {
    yearBuilt: string;
    era: string;
  };
  influences: {
    styles: string[];
    influences: string[];
    traditions: string[];
  };
  purpose: {
    function: string;
    patron: string;
    intent: string;
  };
  significance: {
    importance: string;
    innovations: string;
    influence: string;
  };
}

interface DetailPanelProps {
  landmark: Landmark | null;
  onClose: () => void;
  onNext: () => void;
  currentIndex: number;
  totalInSequence: number;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export const DetailPanel: React.FC<DetailPanelProps> = ({ 
  landmark, 
  onClose,
  onNext,
  currentIndex,
  totalInSequence
}) => {
  const [blueprintUrl, setBlueprintUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ArchitecturalMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkKey();
  }, [landmark]);

  useEffect(() => {
    if (landmark && hasApiKey) {
      generateContent();
    } else {
      setBlueprintUrl(null);
      setMetadata(null);
      setError(null);
    }
  }, [landmark, hasApiKey]);

  const generateContent = async () => {
    if (!landmark) return;
    
    setIsLoading(true);
    setError(null);
    setBlueprintUrl(null);
    setMetadata(null);

    const withRetry = async <T,>(
      fn: () => Promise<T>,
      maxRetries: number = 3,
      initialDelay: number = 2000
    ): Promise<T> => {
      let lastError: any;
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await fn();
        } catch (err: any) {
          lastError = err;
          const errorMessage = err.message || "";
          const isTransient = 
            errorMessage.includes("503") || 
            errorMessage.includes("UNAVAILABLE") ||
            errorMessage.includes("high demand") ||
            err.status === 503;
          
          if (!isTransient || i === maxRetries - 1) {
            throw err;
          }
          
          const delay = initialDelay * Math.pow(2, i);
          console.warn(`Retrying API call (${i + 1}/${maxRetries}) after ${delay}ms due to: ${errorMessage}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      throw lastError;
    };

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Parallel generation of image and metadata with retry logic
      const [imageResponse, textResponse] = await Promise.all([
        withRetry(() => ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: {
            parts: [{ text: `High-detail axonometric (isometric) architectural technical drawing of ${landmark.name} in ${landmark.region}. True isometric projection with no perspective distortion. Architectural massing, detailed facade systems, structural elements, and roof details. Precise, clean, soft blue-gray linework on an aged parchment drafting paper background with subtle grain. Very light washes for surfaces. Minimal technical annotations like section markers, grid hints, and scale references in drafting-style typography. Centered composition with comfortable margins. Archival museum-grade quality, technical precision, calm and timeless aesthetic. No photorealism, no heavy shadows, no perspective.` }],
          },
          config: {
            imageConfig: {
              aspectRatio: "16:9",
              imageSize: "1K"
            }
          },
        })),
        withRetry(() => ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Provide a concise but authoritative architectural description for the landmark: ${landmark.name} (Region: ${landmark.region}, Year: ${landmark.construction_year_start}). Use a scholarly, museum-grade tone.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                location: {
                  type: Type.OBJECT,
                  properties: {
                    country: { type: Type.STRING },
                    cityRegion: { type: Type.STRING },
                    geographicRegion: { type: Type.STRING },
                  },
                  required: ["country", "cityRegion", "geographicRegion"],
                },
                period: {
                  type: Type.OBJECT,
                  properties: {
                    yearBuilt: { type: Type.STRING },
                    era: { type: Type.STRING },
                  },
                  required: ["yearBuilt", "era"],
                },
                influences: {
                  type: Type.OBJECT,
                  properties: {
                    styles: { type: Type.ARRAY, items: { type: Type.STRING } },
                    influences: { type: Type.ARRAY, items: { type: Type.STRING } },
                    traditions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ["styles", "influences", "traditions"],
                },
                purpose: {
                  type: Type.OBJECT,
                  properties: {
                    function: { type: Type.STRING },
                    patron: { type: Type.STRING },
                    intent: { type: Type.STRING },
                  },
                  required: ["function", "patron", "intent"],
                },
                significance: {
                  type: Type.OBJECT,
                  properties: {
                    importance: { type: Type.STRING },
                    innovations: { type: Type.STRING },
                    influence: { type: Type.STRING },
                  },
                  required: ["importance", "innovations", "influence"],
                },
              },
              required: ["location", "period", "influences", "purpose", "significance"],
            },
          },
        }))
      ]);

      // Handle Image
      let foundImage = false;
      for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          setBlueprintUrl(imageUrl);
          foundImage = true;
          break;
        }
      }

      // Handle Metadata
      if (textResponse.text) {
        setMetadata(JSON.parse(textResponse.text));
      }

      if (!foundImage) {
        throw new Error("No blueprint image was generated. Please try again.");
      }
    } catch (err: any) {
      console.error("Content generation error:", err);
      if (err.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setError("API Key session expired or invalid. Please reconnect.");
      } else {
        setError(err.message || "Failed to generate archival records.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Assume success as per guidelines
    }
  };

  return (
    <AnimatePresence>
      {landmark && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 bottom-0 w-full md:w-[600px] bg-charcoal text-parchment z-50 shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-8 flex justify-between items-start border-b border-parchment/10">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] bg-parchment/10 px-2 py-0.5 rounded text-parchment/60">
                  {currentIndex} / {totalInSequence}
                </span>
                <h2 className="text-3xl font-serif italic">{landmark.name}</h2>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-parchment/50">
                {landmark.region} // Built: {landmark.construction_year_start} AD
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-parchment/10 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            {/* Blueprint Viewport */}
            <div className="relative aspect-video bg-[#f4e4bc] rounded-lg overflow-hidden border border-charcoal/20 blueprint-grid-dark flex items-center justify-center group shadow-inner">
              {/* Decorative Archival Stamps/Corners */}
              <div className="absolute top-4 left-4 w-12 h-12 border-t border-l border-charcoal/20 pointer-events-none" />
              <div className="absolute top-4 right-4 w-12 h-12 border-t border-r border-charcoal/20 pointer-events-none" />
              <div className="absolute bottom-4 left-4 w-12 h-12 border-b border-l border-charcoal/20 pointer-events-none" />
              <div className="absolute bottom-4 right-4 w-12 h-12 border-b border-r border-charcoal/20 pointer-events-none" />
              
              {/* Circular Seal (Decorative) */}
              <div className="absolute top-6 left-6 w-8 h-8 rounded-full border border-charcoal/10 flex items-center justify-center pointer-events-none">
                <div className="w-6 h-6 rounded-full border border-charcoal/5 flex items-center justify-center">
                  <span className="font-mono text-[6px] text-charcoal/20">AAM</span>
                </div>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin text-charcoal/40" size={48} />
                  <p className="font-mono text-[10px] uppercase tracking-widest animate-pulse text-charcoal/60">
                    Drawing Architectural Blueprint...
                  </p>
                </div>
              ) : error ? (
                <div className="p-8 text-center space-y-4">
                  <p className="text-red-600 font-mono text-xs">{error}</p>
                  <button 
                    onClick={hasApiKey ? generateContent : handleConnectKey}
                    className="px-4 py-2 bg-charcoal text-parchment font-mono text-[10px] uppercase tracking-widest rounded hover:bg-black transition-colors"
                  >
                    {hasApiKey ? "Retry Generation" : "Connect Archive"}
                  </button>
                </div>
              ) : blueprintUrl ? (
                <motion.img 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  src={blueprintUrl} 
                  alt={`${landmark.name} 3D Axonometric`}
                  className="w-full h-full object-cover mix-blend-multiply"
                />
              ) : !hasApiKey ? (
                <div className="p-8 text-center space-y-6">
                  <div className="flex justify-center">
                    <Key size={48} className="text-charcoal/20" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-serif text-xl italic text-charcoal">Archive Connection Required</h3>
                    <p className="text-charcoal/60 text-sm max-w-xs mx-auto">
                      Access to the high-fidelity architectural archives requires a verified Gemini API key.
                    </p>
                  </div>
                  <button 
                    onClick={handleConnectKey}
                    className="px-6 py-3 bg-charcoal text-parchment font-mono text-[10px] uppercase tracking-widest rounded-full hover:bg-black transition-all transform hover:scale-105"
                  >
                    Connect Archive
                  </button>
                  <div className="flex items-center justify-center gap-2 text-[10px] text-charcoal/40 font-mono uppercase">
                    <Info size={12} />
                    <span>Requires a paid Google Cloud project</span>
                  </div>
                </div>
              ) : null}
              
              {/* Overlay Label */}
              <div className="absolute top-4 right-16 font-mono text-[8px] uppercase tracking-[0.2em] text-charcoal/30 pointer-events-none">
                Axonometric Plate // Ref. {landmark.id.toUpperCase()}
              </div>
            </div>

            {/* Historical Data & Metadata */}
            <div className="space-y-12">
              {/* Core Stats */}
              <div className="grid grid-cols-2 gap-8 border-b border-parchment/10 pb-8">
                <div className="space-y-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-parchment/40">Architect</span>
                  <p className="font-serif text-lg">{landmark.architect || 'Unknown'}</p>
                </div>
                <div className="space-y-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-parchment/40">Coordinates</span>
                  <p className="font-mono text-sm">{landmark.latitude.toFixed(4)}° N, {landmark.longitude.toFixed(4)}° E</p>
                </div>
              </div>

              {metadata ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-10"
                >
                  {/* Location & Period */}
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-parchment/40">Location</span>
                      <div className="font-serif text-base leading-snug">
                        <p>{metadata.location.cityRegion}, {metadata.location.country}</p>
                        <p className="text-parchment/50 italic text-sm">{metadata.location.geographicRegion}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-parchment/40">Period & Era</span>
                      <div className="font-serif text-base leading-snug">
                        <p>{metadata.period.yearBuilt}</p>
                        <p className="text-parchment/50 italic text-sm">{metadata.period.era}</p>
                      </div>
                    </div>
                  </div>

                  {/* Influences */}
                  <div className="space-y-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-parchment/40">Architectural Influences</span>
                    <div className="flex flex-wrap gap-2">
                      {metadata.influences.styles.map((s, i) => (
                        <span key={i} className="px-2 py-1 bg-parchment/5 rounded text-[10px] font-mono text-parchment/70 border border-parchment/10">{s}</span>
                      ))}
                    </div>
                    <p className="font-serif text-base text-parchment/80 leading-relaxed italic">
                      Influenced by {metadata.influences.influences.join(', ')}.
                    </p>
                  </div>

                  {/* Purpose */}
                  <div className="space-y-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-parchment/40">Original Purpose</span>
                    <div className="space-y-2">
                      <p className="font-serif text-lg leading-snug">{metadata.purpose.function}</p>
                      <p className="font-serif text-sm text-parchment/60 leading-relaxed">
                        Commissioned by <span className="text-parchment/80">{metadata.purpose.patron}</span>. {metadata.purpose.intent}
                      </p>
                    </div>
                  </div>

                  {/* Significance */}
                  <div className="space-y-4 p-6 bg-parchment/5 rounded-xl border border-parchment/10 border-dashed">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-parchment/40">Architectural Significance</span>
                    <div className="space-y-4">
                      <p className="font-serif text-base leading-relaxed text-parchment/90">
                        {metadata.significance.importance}
                      </p>
                      <div className="grid grid-cols-1 gap-4 text-sm italic text-parchment/70">
                        <p><span className="font-mono text-[8px] uppercase not-italic text-parchment/30 block mb-1">Innovation</span> {metadata.significance.innovations}</p>
                        <p><span className="font-mono text-[8px] uppercase not-italic text-parchment/30 block mb-1">Legacy</span> {metadata.significance.influence}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-parchment/40">Historical Context</span>
                  <p className="font-serif text-lg leading-relaxed text-parchment/80 italic">
                    "{landmark.description}"
                  </p>
                  {isLoading && (
                    <div className="flex items-center gap-2 font-mono text-[10px] text-parchment/30 animate-pulse">
                      <Loader2 size={10} className="animate-spin" />
                      <span>Retrieving scholarly records...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Controls */}
            <div className="pt-8 border-t border-parchment/10 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="font-mono text-[8px] uppercase tracking-widest text-parchment/30">Index Position</span>
                <span className="font-serif text-xl italic">{currentIndex} of {totalInSequence}</span>
              </div>
              <button 
                onClick={onNext}
                className="flex items-center gap-3 px-8 py-4 bg-parchment text-charcoal rounded-full hover:bg-white transition-all group shadow-xl"
              >
                <span className="font-mono text-[10px] uppercase tracking-widest font-bold">Next Landmark</span>
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Technical Specs (Decorative) */}
            <div className="pt-8 border-t border-parchment/10">
              <div className="grid grid-cols-3 gap-4 font-mono text-[8px] text-parchment/30 uppercase tracking-tighter">
                <div className="space-y-1">
                  <p>Scale: 1:500</p>
                  <p>Paper: Archival Vellum</p>
                </div>
                <div className="space-y-1 text-center">
                  <p>Draft ID: {landmark.id.toUpperCase()}-001</p>
                  <p>Status: Authenticated</p>
                </div>
                <div className="space-y-1 text-right">
                  <p>Date: {new Date().toLocaleDateString()}</p>
                  <p>Museum: A.A.M. Global</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
