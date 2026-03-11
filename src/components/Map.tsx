/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, Maximize2 } from 'lucide-react';
import { Destination } from '../data/destinations';
import { LocalPlace, LOCAL_PLACE_COLORS } from '../data/localPlaces';
import { TripParams, AIResponse } from '../services/travelService';
import { AvatarSVG, NarrationBubble } from './AICursor';
import { AvatarChat } from './AvatarChat';

type AppMode = 'explore' | 'build' | 'flight';

export interface AICursorState {
  destination: Destination;
  narration: string;
  isNarrating: boolean;
  stopIndex: number;
  totalStops: number;
}

interface MapProps {
  destinations: Destination[];
  selectedIds: string[];
  suggestedIds: string[];
  suggestedPrices: Record<string, number>;
  selectedSuggestedId: string | null;
  confirmedDestination: Destination | null;
  localPlaces: LocalPlace[];
  avatarDestination: Destination | null;
  isAvatarChatOpen: boolean;
  focusedId: string | null;
  mode: AppMode;
  origin: string;
  originCoords: [number, number];
  tripParams: TripParams;
  aiCursor: AICursorState | null;
  onSkipTourStop: () => void;
  onAvatarChatToggle: () => void;
  onSelectDestination: (dest: Destination) => void;
  onSelectSuggestedNode: (dest: Destination) => void;
  onAIResponse: (response: AIResponse) => void;
}

interface ZoomState {
  x: number;
  y: number;
  k: number;
}

const WORLD_TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

function greatCircleArc(
  from: [number, number],
  to: [number, number],
  projection: d3.GeoProjection,
  steps = 60
): string | null {
  const interpolate = d3.geoInterpolate(
    [from[0], from[1]] as [number, number],
    [to[0], to[1]] as [number, number]
  );
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const pt = projection(interpolate(i / steps));
    if (pt) points.push(pt);
  }
  if (points.length < 2) return null;
  return d3.line()(points);
}

function buildRoutePath(projected: Array<[number, number] | null>): string | null {
  const valid = projected.filter((p): p is [number, number] => p !== null);
  if (valid.length < 2) return null;
  return d3.line().curve(d3.curveCatmullRom)(valid);
}

const REGION_LABELS: Array<{ label: string; lon: number; lat: number }> = [
  { label: 'EUROPE', lon: 15, lat: 55 },
  { label: 'NORTH AMERICA', lon: -100, lat: 45 },
  { label: 'SOUTH AMERICA', lon: -60, lat: -15 },
  { label: 'AFRICA', lon: 20, lat: 5 },
  { label: 'ASIA', lon: 90, lat: 35 },
  { label: 'OCEANIA', lon: 145, lat: -30 },
];

export const Map: React.FC<MapProps> = ({
  destinations,
  selectedIds,
  suggestedIds,
  suggestedPrices,
  selectedSuggestedId,
  confirmedDestination,
  localPlaces,
  focusedId,
  mode,
  origin,
  originCoords,
  avatarDestination,
  isAvatarChatOpen,
  tripParams,
  aiCursor,
  onSkipTourStop,
  onAvatarChatToggle,
  onSelectDestination,
  onSelectSuggestedNode,
  onAIResponse,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [worldData, setWorldData] = useState<any>(null);
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [zoom, setZoom] = useState<ZoomState>({ x: 0, y: 0, k: 1 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    d3.json(WORLD_TOPO_URL)
      .then((data) => {
        setWorldData(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      setDims({ w: window.innerWidth, h: window.innerHeight });
    });
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  const projection = useMemo(
    () =>
      d3
        .geoNaturalEarth1()
        .scale(dims.w / 6.3)
        .translate([dims.w / 2, dims.h / 2]),
    [dims]
  );

  const pathGen = useMemo(() => d3.geoPath().projection(projection), [projection]);

  const countries = useMemo(() => {
    if (!worldData) return [];
    return (topojson.feature(worldData, (worldData as any).objects.countries) as any).features as any[];
  }, [worldData]);

  const borders = useMemo(() => {
    if (!worldData) return '';
    return pathGen(topojson.mesh(worldData, (worldData as any).objects.countries)) ?? '';
  }, [worldData, pathGen]);

  const sphere = useMemo(() => pathGen({ type: 'Sphere' } as any) ?? '', [pathGen]);

  const graticule = useMemo(() => pathGen(d3.geoGraticule()()) ?? '', [pathGen]);

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);

    const z = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.9, 10])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        const { x, y, k } = event.transform;
        if (gRef.current) {
          gRef.current.setAttribute('transform', `translate(${x},${y}) scale(${k})`);
        }
        setZoom({ x, y, k });
      });

    svg.call(z);
    zoomRef.current = z;

    return () => {
      svg.on('.zoom', null);
    };
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(350).call(zoomRef.current.scaleBy, 1.6);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(350).call(zoomRef.current.scaleBy, 0.625);
  }, []);

  const handleReset = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  const project = useCallback(
    (dest: Destination): [number, number] | null =>
      projection([dest.longitude, dest.latitude]),
    [projection]
  );

  const selectedDestinations = useMemo(
    () =>
      selectedIds
        .map((id) => destinations.find((d) => d.id === id))
        .filter((d): d is Destination => !!d),
    [selectedIds, destinations]
  );

  const routePathD = useMemo(() => {
    if (selectedDestinations.length < 2 || mode === 'flight') return null;
    return buildRoutePath(selectedDestinations.map((d) => project(d)));
  }, [selectedDestinations, project, mode]);

  const flightArcs = useMemo(() => {
    if (mode !== 'flight') return [];
    return selectedDestinations.map((dest) => ({
      id: dest.id,
      path: greatCircleArc(originCoords, [dest.longitude, dest.latitude], projection),
    }));
  }, [mode, selectedDestinations, projection, originCoords]);

  // Deep zoom into confirmed destination (scale 7)
  useEffect(() => {
    if (!confirmedDestination || !svgRef.current || !zoomRef.current) return;
    const pt = projection([confirmedDestination.longitude, confirmedDestination.latitude]);
    if (!pt) return;
    const scale = 7;
    const tx = dims.w / 2 - pt[0] * scale;
    const ty = dims.h / 2 - pt[1] * scale;
    d3.select(svgRef.current)
      .transition()
      .duration(1200)
      .ease(d3.easeCubicInOut)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedDestination?.id]);

  const handleSuggestedNodeClick = useCallback(
    (dest: Destination) => {
      if (svgRef.current && zoomRef.current) {
        const pt = projection([dest.longitude, dest.latitude]);
        if (pt) {
          const scale = 4;
          const tx = dims.w / 2 - pt[0] * scale;
          const ty = dims.h / 2 - pt[1] * scale;
          d3.select(svgRef.current)
            .transition()
            .duration(900)
            .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
        }
      }
      onSelectSuggestedNode(dest);
    },
    [dims, projection, onSelectSuggestedNode]
  );

  const k = zoom.k;

  // Avatar position — during tour use aiCursor.destination, else avatarDestination, else origin
  const avatarActiveDest = aiCursor?.destination ?? avatarDestination ?? null;

  const avatarProjPos = useMemo(() => {
    if (avatarActiveDest) {
      return projection([avatarActiveDest.longitude, avatarActiveDest.latitude]);
    }
    return projection(originCoords);
  }, [avatarActiveDest?.id, originCoords, projection]);

  const avatarScreenPos = useMemo(() => {
    if (!avatarProjPos) return null;
    return {
      x: avatarProjPos[0] * zoom.k + zoom.x,
      y: avatarProjPos[1] * zoom.k + zoom.y,
    };
  }, [avatarProjPos, zoom]);

  // Narration screen pos (same as avatar during tour)
  const cursorScreenPos = avatarScreenPos;

  function markerFill(dest: Destination): string {
    if (selectedIds.includes(dest.id)) return '#C9A84C';
    if (suggestedIds.includes(dest.id)) return '#2D7A5F';
    return '#8B7B5C';
  }

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#F4E4BC' }}>
      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="map-loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8 } }}
            className="absolute inset-0 z-10 flex items-center justify-center"
            style={{ background: '#F4E4BC' }}
          >
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-2 border-[#8B7B5C]/30 border-t-[#8B7B5C] animate-spin rounded-full mx-auto" />
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5C5C]/60">
                Charting the world...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <svg
        ref={svgRef}
        width={dims.w}
        height={dims.h}
        className="cursor-grab active:cursor-grabbing select-none"
        style={{ display: 'block' }}
      >
        <defs>
          <filter id="marker-shadow" x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#1A1A1A" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Ocean — same parchment as background */}
        <path d={sphere} fill="#F4E4BC" />

        <g ref={gRef}>
          {/* Land */}
          {countries.map((feature: any, idx: number) => (
            <path
              key={feature.id || `country-${idx}`}
              d={pathGen(feature) ?? ''}
              fill="#E8D5A8"
              stroke="none"
            />
          ))}

          {/* Borders */}
          <path d={borders} fill="none" stroke="#2C2C2C" strokeWidth={0.5 / k} strokeOpacity={0.55} />

          {/* Graticule */}
          <path d={graticule} fill="none" stroke="#8B7455" strokeWidth={0.25 / k} strokeOpacity={0.18} />

          {/* Region labels */}
          {REGION_LABELS.map((r) => {
            const pt = projection([r.lon, r.lat]);
            if (!pt) return null;
            return (
              <text
                key={r.label}
                x={pt[0]}
                y={pt[1]}
                textAnchor="middle"
                fill="#8B7B5C"
                fillOpacity={0.35}
                fontSize={10 / k}
                fontFamily="'JetBrains Mono', monospace"
                letterSpacing={2 / k}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {r.label}
              </text>
            );
          })}

          {/* Route path */}
          {routePathD && (
            <path
              d={routePathD}
              fill="none"
              stroke="#C9A84C"
              strokeWidth={1.8 / k}
              strokeDasharray={`${7 / k} ${4 / k}`}
              strokeLinecap="round"
              opacity={0.85}
            />
          )}

          {/* Flight arcs */}
          {flightArcs.map((arc) =>
            arc.path ? (
              <path
                key={arc.id}
                d={arc.path}
                fill="none"
                stroke="#2D7A5F"
                strokeWidth={1.5 / k}
                strokeDasharray={`${5 / k} ${3 / k}`}
                strokeLinecap="round"
                opacity={0.7}
              />
            ) : null
          )}
          {/* ── Local place markers (destination mode) ───────────────────── */}
          {confirmedDestination && localPlaces.map((place) => {
            const pt = projection([place.lng, place.lat]);
            if (!pt) return null;
            const color = LOCAL_PLACE_COLORS[place.type];
            return (
              <g
                key={`local-${place.name}`}
                transform={`translate(${pt[0]}, ${pt[1]})`}
                style={{ pointerEvents: 'none' }}
              >
                {/* Glow ring */}
                <circle r={9 / k} fill={color} opacity={0.15} />
                {/* Main dot */}
                <circle r={5 / k} fill={color} stroke="#F5F2ED" strokeWidth={1 / k} />
                {/* Inner dot */}
                <circle r={2 / k} fill="#F5F2ED" />
                {/* Label */}
                <text
                  y={-(9 / k)}
                  textAnchor="middle"
                  fill="#1A1A1A"
                  fontSize={8 / k}
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight="500"
                  style={{ userSelect: 'none' }}
                >
                  {place.name}
                </text>
              </g>
            );
          })}

          {/* Atlas avatar — always visible, moves to destinations */}
          {avatarProjPos && (
            <AvatarSVG
              projX={avatarProjPos[0]}
              projY={avatarProjPos[1]}
              k={k}
              isNarrating={aiCursor?.isNarrating ?? false}
              isChatOpen={isAvatarChatOpen}
              onChatToggle={onAvatarChatToggle}
            />
          )}

          {/* Destination markers */}
          {destinations.map((dest) => {
            const pt = project(dest);
            if (!pt) return null;
            const [x, y] = pt;
            const isSelected = selectedIds.includes(dest.id);
            const isSuggested = suggestedIds.includes(dest.id);
            const isSuggestedFocus = selectedSuggestedId === dest.id;
            const isOtherSuggested = selectedSuggestedId !== null && isSuggested && !isSuggestedFocus;
            const isHovered = hoveredId === dest.id;
            const isFocused = focusedId === dest.id;
            const showLabel = isHovered || isSelected || isFocused || isSuggestedFocus;
            const price = suggestedPrices[dest.id];

            const r = (isHovered || isFocused ? 6 : isSelected || isSuggestedFocus ? 5.8 : isSuggested ? 5.2 : 4) / k;

            return (
              <g
                key={dest.id}
                transform={`translate(${x}, ${y})`}
                style={{ cursor: 'pointer', opacity: isOtherSuggested ? 0.25 : 1, transition: 'opacity 0.35s' }}
                onClick={() => (isSuggested ? handleSuggestedNodeClick(dest) : onSelectDestination(dest))}
                onMouseEnter={() => setHoveredId(dest.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Suggested pulse ring */}
                {isSuggested && !isSelected && (
                  <circle
                    r={isSuggestedFocus ? 12.5 / k : 11 / k}
                    fill="none"
                    stroke={isSuggestedFocus ? '#C9A84C' : '#2D7A5F'}
                    strokeWidth={isSuggestedFocus ? 1.4 / k : 1 / k}
                    opacity={isSuggestedFocus ? 0.65 : 0.35}
                    className={isSuggestedFocus ? undefined : 'animate-pulse'}
                  />
                )}

                {/* Selected outer ring */}
                {isSelected && (
                  <circle r={9 / k} fill="none" stroke="#C9A84C" strokeWidth={1.5 / k} opacity={0.6} />
                )}

                {/* Suggested focus ring */}
                {isSuggestedFocus && (
                  <circle r={10.5 / k} fill="none" stroke="#C9A84C" strokeWidth={1.2 / k} opacity={0.72} />
                )}

                {/* Focus ring */}
                {isFocused && !isSelected && !isSuggestedFocus && (
                  <circle r={9 / k} fill="none" stroke="#C9A84C" strokeWidth={1 / k} opacity={0.5} />
                )}

                {/* Main dot */}
                <circle
                  r={r}
                  fill={isSuggestedFocus ? '#C9A84C' : markerFill(dest)}
                  filter="url(#marker-shadow)"
                />

                {/* Suggested fare tag */}
                {isSuggested && typeof price === 'number' && (
                  <g transform={`translate(${10 / k}, ${-12 / k})`} style={{ pointerEvents: 'none' }}>
                    <rect
                      x={0}
                      y={0}
                      width={34 / k}
                      height={12 / k}
                      rx={3 / k}
                      fill="#F5F2ED"
                      stroke={isSuggestedFocus ? '#C9A84C' : '#2D7A5F'}
                      strokeWidth={0.8 / k}
                      opacity={0.96}
                    />
                    <text
                      x={17 / k}
                      y={8 / k}
                      textAnchor="middle"
                      fill={isSuggestedFocus ? '#8B6A30' : '#1A1A1A'}
                      fontSize={6.8 / k}
                      fontFamily="'JetBrains Mono', monospace"
                      fontWeight="700"
                    >
                      ${price}
                    </text>
                  </g>
                )}

                {/* Label */}
                {showLabel && (
                  <text
                    x={0}
                    y={-(r + 6 / k)}
                    textAnchor="middle"
                    fill={isSelected || isSuggestedFocus ? '#C9A84C' : '#1A1A1A'}
                    fontSize={9 / k}
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight={isSelected || isSuggestedFocus ? '600' : '400'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {dest.name}
                  </text>
                )}

                {/* Order number */}
                {isSelected && (
                  <text
                    x={0}
                    y={r * 0.38}
                    textAnchor="middle"
                    fill="#1A1A1A"
                    fontSize={r * 1.15}
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight="700"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {selectedIds.indexOf(dest.id) + 1}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* AI narration bubble — shown during tour */}
      {aiCursor && cursorScreenPos && (
        <NarrationBubble
          narration={aiCursor.narration}
          isVisible={aiCursor.isNarrating}
          screenX={cursorScreenPos.x}
          screenY={cursorScreenPos.y}
          screenW={dims.w}
          screenH={dims.h}
          stopIndex={aiCursor.stopIndex}
          totalStops={aiCursor.totalStops}
          destinationName={aiCursor.destination.name}
          onSkip={onSkipTourStop}
        />
      )}

      {/* Avatar contextual chat — anchored to avatar screen position */}
      {avatarScreenPos && (
        <AvatarChat
          isOpen={isAvatarChatOpen}
          onClose={onAvatarChatToggle}
          screenX={avatarScreenPos.x}
          screenY={avatarScreenPos.y}
          screenW={dims.w}
          screenH={dims.h}
          currentDestination={avatarActiveDest}
          originName={origin}
          tripParams={tripParams}
          onAIResponse={onAIResponse}
        />
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-36 right-5 z-20 flex flex-col gap-1.5">
        {[
          { icon: <Plus size={15} />, fn: handleZoomIn, title: 'Zoom in' },
          { icon: <Minus size={15} />, fn: handleZoomOut, title: 'Zoom out' },
          { icon: <Maximize2 size={13} />, fn: handleReset, title: 'Reset view' },
        ].map(({ icon, fn, title }) => (
          <button
            key={title}
            onClick={fn}
            title={title}
            className="w-9 h-9 bg-parchment/90 backdrop-blur-sm border border-ink/10 shadow-md flex items-center justify-center text-ink/50 hover:text-ink hover:bg-parchment transition-all rounded"
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Coordinate tooltip */}
      <AnimatePresence>
        {hoveredId && (() => {
          const dest = destinations.find((d) => d.id === hoveredId);
          if (!dest) return null;
          return (
            <motion.div
              key="coord-tip"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-36 left-1/2 -translate-x-1/2 pointer-events-none z-20"
            >
              <div className="bg-ink/85 backdrop-blur-sm text-parchment px-4 py-2 rounded text-center shadow-xl">
                <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-parchment/50">
                  {dest.country} · {dest.region}
                </p>
                <p className="font-mono text-[10px] tracking-wider mt-0.5">{dest.coordinates}</p>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Flight mode badge */}
      <AnimatePresence>
        {mode === 'flight' && (
          <motion.div
            key="flight-badge"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-5 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
          >
            <div className="bg-emerald/90 backdrop-blur-sm text-parchment px-5 py-2 rounded-full shadow-lg border border-emerald/20">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em]">
                Flight Discovery · Routes from {origin || 'New York'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
