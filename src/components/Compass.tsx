/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';

export const Compass: React.FC = () => {
  const directions = [
    { label: 'N', y: -75, x: 0 },
    { label: 'S', y: 75, x: 0 },
    { label: 'E', y: 0, x: 75 },
    { label: 'W', y: 0, x: -75 }
  ];

  const needlePath = "M 0 -60 L 8 0 L 0 60 L -8 0 Z";
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <div className="fixed bottom-[75px] left-8 sm:left-12 z-50 pointer-events-none select-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 0.5, scale: 0.6 }}
        className="relative origin-bottom-left"
      >
        <svg width="200" height="250" viewBox="-100 -100 200 250">
          {/* Compass needles */}
          {angles.map(angle => (
            <path
              key={angle}
              d={needlePath}
              fill={angle % 90 === 0 ? '#5C5C5C' : 'none'}
              stroke="#5C5C5C"
              strokeWidth="1"
              transform={`rotate(${angle})`}
            />
          ))}

          {/* Direction Labels */}
          {directions.map(d => (
            <text
              key={d.label}
              x={d.x}
              y={d.y + 4}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize="14px"
              fontWeight="bold"
              fill="#5C5C5C"
            >
              {d.label}
            </text>
          ))}

          {/* Cartographia Label */}
          <text
            y="100"
            textAnchor="middle"
            fontFamily="var(--font-serif)"
            fontSize="10px"
            fontStyle="italic"
            letterSpacing="2px"
            fill="#5C5C5C"
          >
            CARTOGRAPHIA
          </text>
        </svg>
      </motion.div>
    </div>
  );
};
