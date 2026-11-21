import React from 'react';

const TourOverlay = ({ targetRect }) => {
  // If no target yet, just show a plain dark backdrop
  if (!targetRect) {
    return (
      <div className="fixed inset-0 z-[9998] pointer-events-auto transition-opacity duration-300">
        <div className="absolute inset-0 bg-red-500/70" />
      </div>
    );
  }

  // Spotlight dimensions with padding
  const padding = 8;
  const x = Math.max(0, targetRect.left - padding);
  const y = Math.max(0, targetRect.top - padding);
  const width = targetRect.width + (padding * 2);
  const height = targetRect.height + (padding * 2);
  const rx = 8; // border radius for the spotlight

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-auto transition-all duration-300">
      <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none">
        <defs>
          <mask id="tour-spotlight">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              rx={rx}
              fill="black"
              className="transition-all duration-300 ease-in-out"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(239, 68, 68, 0.7)"
          mask="url(#tour-spotlight)"
        />
      </svg>
      
      {/* Invisible layer to block clicks on the target itself during the tour */}
      <div 
        className="absolute"
        style={{ 
          left: x, 
          top: y, 
          width, 
          height,
          transition: 'all 300ms ease-in-out' 
        }} 
      />
    </div>
  );
};

export default TourOverlay;
