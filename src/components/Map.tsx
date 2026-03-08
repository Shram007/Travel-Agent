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
import { AICursorSVG, NarrationBubble } from './AICursor';

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
  focusedId: string | null;
  mode: AppMode;
  origin: string;
  aiCursor: AICursorState | null;
  onSkipTourStop: () => void;
  onSelectDestination: (dest: Destination) => void;
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
  focusedId,
  mode,
  origin,
  aiCursor,
  onSkipTourStop,
  onSelectDestination,
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
    const originCoords: [number, number] = [-74.006, 40.7128]; // Default: New York
    return selectedDestinations.map((dest) => ({
      id: dest.id,
      path: greatCircleArc(originCoords, [dest.longitude, dest.latitude], projection),
    }));
  }, [mode, selectedDestinations, projection]);

  const k = zoom.k;

  // AI cursor — project destination to SVG space and screen space
  const cursorProjPos = useMemo(() => {
    if (!aiCursor) return null;
    return projection([aiCursor.destination.longitude, aiCursor.destination.latitude]);
  }, [aiCursor?.destination.id, projection]);

  const cursorScreenPos = useMemo(() => {
    if (!cursorProjPos) return null;
    return {
      x: cursorProjPos[0] * zoom.k + zoom.x,
      y: cursorProjPos[1] * zoom.k + zoom.y,
    };
  }, [cursorProjPos, zoom]);

  function markerFill(dest: Destination): string {
    if (selectedIds.includes(dest.id)) return '#C9A84C';
    if (suggestedIds.includes(dest.id)) return '#2D7A5F';
    return '#8B7B5C';
  }

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#C8D8E4' }}>
      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="map-loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8 } }}
            className="absolute inset-0 z-10 flex items-center justify-center"
            style={{ background: '#C8D8E4' }}
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
          <radialGradient id="ocean-grad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#D4E4EE" />
            <stop offset="100%" stopColor="#B8CCDA" />
          </radialGradient>
          <linearGradient id="land-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#EDE8DC" />
            <stop offset="100%" stopColor="#E0D8C8" />
          </linearGradient>
          <filter id="marker-shadow" x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#1A1A1A" floodOpacity="0.3" />
          </filter>
          <filter id="label-bg" x="-10%" y="-30%" width="120%" height="160%">
            <feFlood floodColor="#F5F2ED" floodOpacity="0.85" result="bg" />
            <feMerge>
              <feMergeNode in="bg" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ocean */}
        <path d={sphere} fill="url(#ocean-grad)" />

        <g ref={gRef}>
          {/* Land */}
          {countries.map((feature: any) => (
            <path
              key={feature.id}
              d={pathGen(feature) ?? ''}
              fill="url(#land-grad)"
              stroke="none"
            />
          ))}

          {/* Borders */}
          <path d={borders} fill="none" stroke="#C4B89A" strokeWidth={0.6 / k} strokeOpacity={0.9} />

          {/* Graticule */}
          <path d={graticule} fill="none" stroke="#B8CCDA" strokeWidth={0.35 / k} strokeOpacity={0.5} />

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

          {/* AI tour cursor — rendered on top of all map layers */}
          {aiCursor && cursorProjPos && (
            <AICursorSVG
              projX={cursorProjPos[0]}
              projY={cursorProjPos[1]}
              k={k}
            />
          )}

          {/* Destination markers */}
          {destinations.map((dest) => {
            const pt = project(dest);
            if (!pt) return null;
            const [x, y] = pt;
            const isSelected = selectedIds.includes(dest.id);
            const isSuggested = suggestedIds.includes(dest.id);
            const isHovered = hoveredId === dest.id;
            const isFocused = focusedId === dest.id;
            const showLabel = isHovered || isSelected || isFocused;

            const r = (isHovered || isFocused ? 6 : isSelected ? 5.5 : isSuggested ? 5 : 4) / k;

            return (
              <g
                key={dest.id}
                transform={`translate(${x}, ${y})`}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectDestination(dest)}
                onMouseEnter={() => setHoveredId(dest.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Suggested pulse ring */}
                {isSuggested && !isSelected && (
                  <circle r={11 / k} fill="none" stroke="#2D7A5F" strokeWidth={1 / k} opacity={0.35} />
                )}

                {/* Selected outer ring */}
                {isSelected && (
                  <circle r={9 / k} fill="none" stroke="#C9A84C" strokeWidth={1.5 / k} opacity={0.6} />
                )}

                {/* Focus ring */}
                {isFocused && !isSelected && (
                  <circle r={9 / k} fill="none" stroke="#C9A84C" strokeWidth={1 / k} opacity={0.5} />
                )}

                {/* Main dot */}
                <circle
                  r={r}
                  fill={markerFill(dest)}
                  filter="url(#marker-shadow)"
                />

                {/* Label */}
                {showLabel && (
                  <text
                    x={0}
                    y={-(r + 6 / k)}
                    textAnchor="middle"
                    fill={isSelected ? '#C9A84C' : '#1A1A1A'}
                    fontSize={9 / k}
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight={isSelected ? '600' : '400'}
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

      {/* AI narration bubble — HTML overlay positioned in screen space */}
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
