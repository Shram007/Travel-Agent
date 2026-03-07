/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { Landmark } from '../data/landmarks';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, Maximize } from 'lucide-react';

interface MapProps {
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  onVisibleInViewChange?: (count: number) => void;
  selectedLandmarkId?: string;
  selectedCountry?: string | null;
  onCountryClick?: (country: string | null) => void;
  navigationTransition?: { from: Landmark; to: Landmark } | null;
}

const REGIONS = [
  { name: 'Americas', coords: [-100, 40] },
  { name: 'Europe', coords: [15, 50] },
  { name: 'MENA', coords: [35, 25] },
  { name: 'Africa', coords: [20, 0] },
  { name: 'South Asia', coords: [75, 20] },
  { name: 'East Asia & Pacific', coords: [120, 30] },
  { name: 'Oceania', coords: [140, -25] }
];

// Validation Sample: [longitude, latitude]
const VALIDATION_SAMPLE = [
  { name: 'Pantheon', coords: [12.4769, 41.8986] },
  { name: 'Notre Dame', coords: [2.3499, 48.8530] },
  { name: 'Hagia Sophia', coords: [28.9784, 41.0085] }
];

// Memoized Country Path component to prevent redundant re-renders
const CountryPath = React.memo(({ 
  feature, 
  pathGenerator, 
  isSelected, 
  isDimmed, 
  k, 
  onClick 
}: { 
  feature: any, 
  pathGenerator: any, 
  isSelected: boolean, 
  isDimmed: boolean, 
  k: number, 
  onClick: (e: React.MouseEvent) => void 
}) => {
  const countryName = feature?.properties?.name;
  if (!countryName) return null;

  return (
    <path
      d={pathGenerator(feature) || ''}
      className="country transition-colors duration-200"
      fill={isSelected ? '#d9c58c' : '#ECD4A1'}
      fillOpacity={isDimmed ? 0.1 : 1}
      stroke={isSelected ? '#1a1a1a' : '#4a4238'}
      strokeWidth={isSelected ? 1 / k : 0.4 / k}
      style={{ vectorEffect: 'non-scaling-stroke', cursor: 'pointer' }}
      onClick={onClick}
    />
  );
});

// Memoized Landmark Marker component
const LandmarkMarker = React.memo(({ 
  landmark, 
  projection, 
  currentTransform, 
  isSelected, 
  isTransitioningFrom, 
  onSelect 
}: { 
  landmark: Landmark, 
  projection: any, 
  currentTransform: d3.ZoomTransform, 
  isSelected: boolean, 
  isTransitioningFrom: boolean, 
  onSelect: (l: Landmark) => void 
}) => {
  const coords = projection([landmark.longitude, landmark.latitude]);
  if (!coords) return null;
  const [x, y] = coords;
  
  const tx = x * currentTransform.k + currentTransform.x;
  const ty = y * currentTransform.k + currentTransform.y;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      onClick={() => onSelect(landmark)}
      className="absolute pointer-events-auto flex items-end justify-start group"
      style={{ 
        left: tx - 8, // Offset by half of flag width (16/2 = 8) to center the pole
        top: ty - 40, // Offset by full flag height (40) to place the base of the pole at the coordinate
      }}
    >
      <div className="relative">
        <div className="absolute bottom-0 left-0 w-4 h-1.5 bg-charcoal/10 blur-[1px] rounded-full translate-x-1 translate-y-0.5" />
        <svg 
          width="32" 
          height="40" 
          viewBox="0 0 32 40" 
          fill="none" 
          className={`transition-all duration-500 origin-bottom ${isSelected || isTransitioningFrom ? 'scale-125' : 'group-hover:scale-110'}`}
          style={{ transform: 'rotate(-2deg)' }}
        >
          <line x1="8" y1="40" x2="8" y2="8" stroke="#4a4238" strokeWidth="1.2" strokeLinecap="round" />
          <motion.path
            d="M4 10 C 4 10, 12 9, 28 10 L 24 16 L 28 22 C 12 23, 4 22, 4 22 Z"
            fill={isSelected || isTransitioningFrom ? "#d9c58c" : "#c8b9a6"}
            fillOpacity="0.9"
            stroke="#4a4238"
            strokeWidth="0.8"
            strokeLinejoin="round"
            animate={{
              fill: isSelected || isTransitioningFrom ? "#d9c58c" : "#c8b9a6",
              d: isSelected || isTransitioningFrom 
                ? "M4 9 C 4 9, 14 8, 32 9 L 26 16 L 32 23 C 14 24, 4 23, 4 23 Z" 
                : "M4 10 C 4 10, 12 9, 28 10 L 24 16 L 28 22 C 12 23, 4 22, 4 22 Z"
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          />
          <line x1="8" y1="11" x2="8" y2="21" stroke="#4a4238" strokeWidth="1.2" strokeOpacity="0.6" />
          <circle cx="8" cy="8" r="2.5" fill="#f4e4bc" stroke="#4a4238" strokeWidth="0.8" />
          <path d="M6 12 L20 13" stroke="#4a4238" strokeOpacity="0.1" strokeWidth="1" />
          <path d="M6 18 L18 19" stroke="#4a4238" strokeOpacity="0.1" strokeWidth="1" />
        </svg>
        {(isSelected || isTransitioningFrom) && (
          <div className="absolute bottom-0 left-[6px] w-6 h-6 -translate-x-1/2 translate-y-1/2 border border-charcoal/20 rounded-full animate-ping pointer-events-none" />
        )}
      </div>
    </motion.button>
  );
});

export const Map = React.memo(({ 
  landmarks, 
  onSelectLandmark,
  onVisibleInViewChange,
  selectedLandmarkId,
  selectedCountry,
  onCountryClick,
  navigationTransition
}: MapProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
  const [currentTransform, setCurrentTransform] = React.useState(d3.zoomIdentity);
  const [isValidated, setIsValidated] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [mapDataLevel, setMapDataLevel] = React.useState<'50m' | '10m' | null>(null);
  const [countryFeatures, setCountryFeatures] = React.useState<any[]>([]);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const cityDetailRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const selectedCountryRef = useRef<string | null>(selectedCountry || null);

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        setDimensions({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Stable Projection: Independent of container dimensions
  const projection = useMemo(() => {
    // Standard Mercator projection centered at [0, 0]
    // We use a fixed scale of 500 so the world is 1000 units wide
    return d3.geoMercator()
      .scale(1000 / (2 * Math.PI))
      .translate([0, 0])
      .precision(0.1); // Increased precision for better alignment
  }, []);

  // Path generator
  const pathGenerator = useMemo(() => {
    return d3.geoPath().projection(projection);
  }, [projection]);

  // Update ref when state changes
  useEffect(() => {
    selectedCountryRef.current = selectedCountry || null;
  }, [selectedCountry]);

  // Filter landmarks based on year and coordinate validity
  // Note: landmarks prop is already filtered in App.tsx, so we just ensure coordinates are valid
  const visibleLandmarks = useMemo(() => {
    return landmarks.filter(l => {
      return typeof l.latitude === 'number' && typeof l.longitude === 'number' && 
             !isNaN(l.latitude) && !isNaN(l.longitude) &&
             l.latitude !== 0 && l.longitude !== 0;
    });
  }, [landmarks]);

  // Initialize SVG and Zoom
  useEffect(() => {
    if (!svgRef.current || !projection || dimensions.width === 0) return;

    const svg = d3.select(svgRef.current)
      .attr('width', dimensions.width)
      .attr('height', dimensions.height);

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 40])
      .on('zoom', (event) => {
        setCurrentTransform(event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom as any);
    
    // Initial View: Center on Prime Meridian/Equator and fit to width
    // Our projection has world width = 1000. 
    // To fit dimensions.width, we need k = dimensions.width / 1000
    const initialScale = dimensions.width / 1000; 
    const tx = dimensions.width / 2;
    const ty = dimensions.height / 2;
    
    const initialTransform = d3.zoomIdentity
      .translate(tx, ty)
      .scale(initialScale);

    svg.call(zoom.transform, initialTransform);
    setCurrentTransform(initialTransform);
    setIsValidated(true);
  }, [projection, dimensions.width, dimensions.height]);

  // Calculate visible in view
  useEffect(() => {
    if (!projection || dimensions.width === 0 || !onVisibleInViewChange) return;
    
    const count = visibleLandmarks.filter(landmark => {
      const [x, y] = projection([landmark.longitude, landmark.latitude]) || [-1000, -1000];
      
      // Project to screen space using current zoom transform
      const px = x * currentTransform.k + currentTransform.x;
      const py = y * currentTransform.k + currentTransform.y;
      
      return px >= 0 && px <= dimensions.width && py >= 0 && py <= dimensions.height;
    }).length;
    
    onVisibleInViewChange(count);
  }, [visibleLandmarks, currentTransform, projection, onVisibleInViewChange, dimensions]);

  // Handle map data loading
  useEffect(() => {
    const controller = new AbortController();
    const url = `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json`;

    fetch(url, { signal: controller.signal })
      .then(res => res.json())
      .then((data: any) => {
        const countries = topojson.feature(data, data.objects.countries) as any;
        setCountryFeatures(countries.features);
        setMapDataLevel('50m');
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.error('Failed to load map data:', err);
      });

    return () => controller.abort();
  }, []);

  // Handle city detail reveal and generation
  useEffect(() => {
    if (!cityDetailRef.current || !projection) return;

    const g = cityDetailRef.current;
    
    // Show when zoomed in significantly OR when a country is focused
    const isLandmarkFocused = !!selectedLandmarkId;
    const isCountryFocused = !!selectedCountry;
    const showDetail = currentTransform.k > 3.0 || isCountryFocused;
    
    if (!showDetail) {
      g.transition().duration(500).attr('opacity', 0);
      return;
    }

    // Determine focus points
    let focusPoints: { id: string, longitude: number, latitude: number, radius: number }[] = [];

    if (isLandmarkFocused) {
      const landmark = landmarks.find(l => l.id === selectedLandmarkId);
      if (landmark) {
        focusPoints.push({ id: landmark.id, longitude: landmark.longitude, latitude: landmark.latitude, radius: 180 });
      }
    } else if (isCountryFocused) {
      const countryLandmarks = landmarks.filter(l => l.country === selectedCountry);
      if (countryLandmarks.length > 0) {
        focusPoints = countryLandmarks.map(l => ({
          id: l.id,
          longitude: l.longitude,
          latitude: l.latitude,
          radius: 140
        }));
      }
    } else if (currentTransform.k > 4.0) {
      // Use a much more stable key for view-center to avoid regeneration during pan
      const stableLon = Math.round(projection.invert!([
        (containerRef.current!.clientWidth / 2 - currentTransform.x) / currentTransform.k,
        0
      ])[0] / 5) * 5;
      const stableLat = Math.round(projection.invert!([
        0,
        (containerRef.current!.clientHeight / 2 - currentTransform.y) / currentTransform.k
      ])[1] / 5) * 5;
      
      focusPoints.push({ id: `view-${stableLon}-${stableLat}`, longitude: stableLon, latitude: stableLat, radius: 200 });
    }

    if (focusPoints.length === 0) {
      g.transition().duration(500).attr('opacity', 0);
      return;
    }

    // Generate procedural survey grids for all focus points
    // For view-center, we update more frequently or use a different key
    const currentFocusKey = isCountryFocused || isLandmarkFocused 
      ? focusPoints.map(p => p.id).join('|')
      : `center-${Math.round(focusPoints[0].longitude)}-${Math.round(focusPoints[0].latitude)}`;

    if (g.attr('data-focus-key') !== currentFocusKey) {
      g.selectAll('*').remove();
      g.attr('data-focus-key', currentFocusKey);
      
      const inkColor = '#3a352f'; // Darker, sepia-toned ink
      const roadColor = '#4a4238';
      
      focusPoints.forEach(point => {
        const [cx, cy] = projection([point.longitude, point.latitude]) || [0, 0];
        const cluster = g.append('g').attr('class', `city-plan-${point.id}`);

        // Only keep the City Label (Subtle archival label)
        if (isLandmarkFocused) {
          const landmark = landmarks.find(l => l.id === selectedLandmarkId);
          if (landmark) {
            const labelGroup = cluster.append('g')
              .attr('transform', `translate(${cx}, ${cy - 35})`);

            labelGroup.append('text')
              .attr('text-anchor', 'middle')
              .attr('font-family', 'var(--font-serif)')
              .attr('font-size', '11px')
              .attr('font-style', 'italic')
              .attr('fill', inkColor)
              .attr('opacity', 0.9)
              .text(landmark.city || landmark.name);

            labelGroup.append('line')
              .attr('x1', -20)
              .attr('y1', 4)
              .attr('x2', 20)
              .attr('y2', 4)
              .attr('stroke', inkColor)
              .attr('stroke-width', 0.4)
              .attr('opacity', 0.4);
          }
        }
      });
    }

    g.transition().duration(800).attr('opacity', 1);
  }, [selectedLandmarkId, selectedCountry, currentTransform.k, projection, landmarks]);

  // Handle country focus zoom
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current || !projection || !containerRef.current || countryFeatures.length === 0) return;

    if (selectedCountry) {
      // Find country feature to get bounds from pre-loaded data
      const country = countryFeatures.find((f: any) => f?.properties?.name === selectedCountry);
      
      if (country) {
        const path = d3.geoPath().projection(projection);
        const bounds = path.bounds(country);
        const dx = bounds[1][0] - bounds[0][0];
        const dy = bounds[1][1] - bounds[0][1];
        const x = (bounds[0][0] + bounds[1][0]) / 2;
        const y = (bounds[0][1] + bounds[1][1]) / 2;
        
        const width = containerRef.current!.clientWidth;
        const height = containerRef.current!.clientHeight;
        
        const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
        
        d3.select(svgRef.current)
          .transition()
          .duration(1000)
          .call(
            zoomRef.current!.transform,
            d3.zoomIdentity
              .translate(width / 2, height / 2)
              .scale(scale)
              .translate(-x, -y)
          );
      }
    } else {
      // Reset to global view if country is cleared (and not in a landmark transition)
      if (!navigationTransition) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const mapWidth = width;
        const mapHeight = height;
        const initialScale = 0.75;
        const focusCoords: [number, number] = [20, 25];
        const [focusX, focusY] = projection(focusCoords) || [mapWidth / 2, mapHeight / 2];
        
        const tx = width / 2 - focusX * initialScale;
        const ty = height / 2 - focusY * initialScale;

        d3.select(svgRef.current)
          .transition()
          .duration(1000)
          .call(
            zoomRef.current!.transform,
            d3.zoomIdentity.translate(tx, ty).scale(initialScale)
          );
      }
    }
  }, [selectedCountry, projection]);

  // Handle synchronized zoom transition
  useEffect(() => {
    if (navigationTransition && svgRef.current && zoomRef.current && projection && containerRef.current) {
      const { to } = navigationTransition;
      const [x, y] = projection([to.longitude, to.latitude]) || [0, 0];
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      // Wait for arc animation to complete before zooming
      const timer = setTimeout(() => {
        d3.select(svgRef.current)
          .transition()
          .duration(700) // Zoom duration
          .ease(d3.easeCubicInOut)
          .call(
            zoomRef.current!.transform, 
            d3.zoomIdentity
              .translate(width / 2, height / 2)
              .scale(5) // Country-level zoom
              .translate(-x, -y)
          );
      }, 850); // Wait for arc animation (600-900ms)

      return () => clearTimeout(timer);
    }
  }, [navigationTransition, projection]);

  // Zoom behavior
  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (!svgRef.current || !zoomRef.current) return;
    
    const svg = d3.select(svgRef.current);
    if (direction === 'reset') {
      const initialScale = dimensions.width / 1000; 
      const tx = dimensions.width / 2;
      const ty = dimensions.height / 2;
      
      svg.transition().duration(750).call(
        zoomRef.current.transform, 
        d3.zoomIdentity.translate(tx, ty).scale(initialScale)
      );
    } else {
      const factor = direction === 'in' ? 1.5 : 0.66;
      svg.transition().duration(300).call(zoomRef.current.scaleBy, factor);
    }
  };

  if (validationError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 p-8 text-center">
        <div className="max-w-md space-y-4">
          <h2 className="text-red-600 font-serif text-2xl italic">Cartographic Error</h2>
          <p className="text-charcoal/70 font-mono text-xs uppercase tracking-widest">{validationError}</p>
          <p className="text-charcoal/60 text-sm">The map projection failed to validate geographic anchors. Please check data source integrity.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative archival-grain bg-[#F1DAAD] overflow-hidden">
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing">
        <g transform={currentTransform.toString()}>
          {/* Ocean background - cover a huge area in projection units */}
          <rect
            width={10000}
            height={10000}
            x={-5000}
            y={-5000}
            fill="#F1DAAD"
            onClick={() => onCountryClick?.(null)}
          />
          
          {/* Countries */}
          <g className="countries-group">
            {countryFeatures.map((feature, i) => (
              <CountryPath
                key={feature.id ? `country-${feature.id}-${i}` : `country-${i}`}
                feature={feature}
                pathGenerator={pathGenerator}
                isSelected={feature?.properties?.name === selectedCountry}
                isDimmed={currentTransform.k > 15}
                k={currentTransform.k}
                onClick={(e) => {
                  e.stopPropagation();
                  const name = feature?.properties?.name;
                  if (name) onCountryClick?.(name === selectedCountry ? null : name);
                }}
              />
            ))}
          </g>

          {/* City Detail Group (Placeholder for procedural details) */}
          <g className="city-detail" opacity={currentTransform.k > 3.0 || !!selectedCountry ? 1 : 0}>
            {/* We could render procedural details here if needed, 
                but for now let's focus on alignment */}
          </g>
        </g>
      </svg>
      
      {/* Navigation Line Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <svg className="w-full h-full">
          <AnimatePresence>
            {navigationTransition && projection && (() => {
              const from = projection([navigationTransition.from.longitude, navigationTransition.from.latitude]);
              const to = projection([navigationTransition.to.longitude, navigationTransition.to.latitude]);
              if (!from || !to) return null;

              const x1 = from[0] * currentTransform.k + currentTransform.x;
              const y1 = from[1] * currentTransform.k + currentTransform.y;
              const x2 = to[0] * currentTransform.k + currentTransform.x;
              const y2 = to[1] * currentTransform.k + currentTransform.y;

              // Calculate curved arc path (Quadratic Bezier)
              const dx = x2 - x1;
              const dy = y2 - y1;
              const dr = Math.sqrt(dx * dx + dy * dy);
              
              // Midpoint
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              
              // Control point offset perpendicular to the line
              const offset = dr * 0.25; // Curve height
              const angle = Math.atan2(dy, dx);
              const cx = mx - offset * Math.sin(angle);
              const cy = my + offset * Math.cos(angle);

              return (
                <motion.path
                  key={`nav-arc-${navigationTransition.from.id}-${navigationTransition.to.id}`}
                  d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.8 }}
                  exit={{ opacity: 0 }}
                  transition={{ 
                    pathLength: { duration: 0.8, ease: "easeInOut" },
                    opacity: { duration: 0.3 }
                  }}
                  stroke="#4a4238" // Sepia ink stroke
                  strokeWidth="2" 
                  fill="none"
                  strokeLinecap="round"
                />
              );
            })()}
          </AnimatePresence>
        </svg>
      </div>

      {/* Landmark Markers */}
      <div className="absolute inset-0 pointer-events-none">
        <AnimatePresence>
          {projection && isValidated && visibleLandmarks.map((landmark) => (
            <LandmarkMarker
              key={landmark.id}
              landmark={landmark}
              projection={projection}
              currentTransform={currentTransform}
              isSelected={selectedLandmarkId === landmark.id}
              isTransitioningFrom={navigationTransition?.from.id === landmark.id && selectedLandmarkId === navigationTransition.from.id}
              onSelect={onSelectLandmark}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Zoom Controls (Fixed to lower-right) */}
      <div className="absolute bottom-[120px] right-8 flex flex-col gap-2 z-40">
        <button 
          onClick={() => handleZoom('in')}
          className="w-10 h-10 bg-parchment/80 backdrop-blur-md border border-charcoal/10 rounded-full flex items-center justify-center text-charcoal/60 hover:bg-charcoal hover:text-parchment transition-all shadow-lg"
          title="Zoom In"
        >
          <Plus size={18} />
        </button>
        <button 
          onClick={() => handleZoom('out')}
          className="w-10 h-10 bg-parchment/80 backdrop-blur-md border border-charcoal/10 rounded-full flex items-center justify-center text-charcoal/60 hover:bg-charcoal hover:text-parchment transition-all shadow-lg"
          title="Zoom Out"
        >
          <Minus size={18} />
        </button>
        <button 
          onClick={() => handleZoom('reset')}
          className="w-10 h-10 bg-parchment/80 backdrop-blur-md border border-charcoal/10 rounded-full flex items-center justify-center text-charcoal/60 hover:bg-charcoal hover:text-parchment transition-all shadow-lg mt-2"
          title="Reset View"
        >
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
});
