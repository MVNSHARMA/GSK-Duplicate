import React, { useLayoutEffect, useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';

const TourCard = ({ 
  step, 
  currentStepIndex, 
  totalSteps, 
  onNext, 
  onPrev, 
  onSkip, 
  onFinish,
  targetRect 
}) => {
  const cardRef = useRef(null);
  const [style, setStyle] = useState({ opacity: 0 });

  useLayoutEffect(() => {
    if (!targetRect || !cardRef.current) return;

    const card = cardRef.current.getBoundingClientRect();
    const padding = 16; // space between target and card
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Preferred placement
    let placement = step.placement || 'bottom';
    
    // Calculate potential positions
    const positions = {
      top: {
        top: targetRect.top - card.height - padding,
        left: Math.max(16, Math.min(targetRect.left + (targetRect.width / 2) - (card.width / 2), vw - card.width - 16))
      },
      bottom: {
        top: targetRect.bottom + padding,
        left: Math.max(16, Math.min(targetRect.left + (targetRect.width / 2) - (card.width / 2), vw - card.width - 16))
      },
      left: {
        top: Math.max(16, Math.min(targetRect.top + (targetRect.height / 2) - (card.height / 2), vh - card.height - 16)),
        left: targetRect.left - card.width - padding
      },
      right: {
        top: Math.max(16, Math.min(targetRect.top + (targetRect.height / 2) - (card.height / 2), vh - card.height - 16)),
        left: targetRect.right + padding
      }
    };

    // Fallback logic
    if (placement === 'right' && positions.right.left + card.width > vw - 16) placement = 'left';
    if (placement === 'left' && positions.left.left < 16) placement = 'bottom';
    if (placement === 'bottom' && positions.bottom.top + card.height > vh - 16) placement = 'top';
    if (placement === 'top' && positions.top.top < 16) placement = 'bottom';

    // If still offscreen, clamp it to screen
    let finalTop = positions[placement].top;
    let finalLeft = positions[placement].left;

    finalTop = Math.max(16, Math.min(finalTop, vh - card.height - 16));
    finalLeft = Math.max(16, Math.min(finalLeft, vw - card.width - 16));

    setStyle({
      top: finalTop,
      left: finalLeft,
      opacity: 1,
      transition: 'all 300ms ease-in-out'
    });

  }, [targetRect, step.placement, window.innerWidth, window.innerHeight]);

  // Handle keyboard within the card
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onSkip();
    }
  };

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-labelledby="tour-title"
      aria-describedby="tour-desc"
      onKeyDown={handleKeyDown}
      tabIndex="-1"
      className="fixed z-[9999] w-[380px] sm:w-[450px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col focus:outline-none"
      style={style}
    >
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
        <h3 id="tour-title" className="font-black text-dark text-xl">{step.title}</h3>
        <button 
          onClick={onSkip}
          aria-label="Close tour"
          className="text-gray-400 hover:text-red-500 transition-colors p-1"
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="p-6">
        <p id="tour-desc" className="text-base text-gray-700 leading-relaxed font-medium">
          {step.description}
        </p>
      </div>
      
      <div className="px-6 py-5 bg-gray-50/50 rounded-b-2xl border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5" aria-label={`Step ${currentStepIndex + 1} of ${totalSteps}`}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div 
              key={i} 
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentStepIndex 
                  ? 'w-6 bg-red-600' 
                  : i < currentStepIndex 
                    ? 'w-2 bg-red-200' 
                    : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={onSkip}
            className="text-xs font-bold text-gray-400 hover:text-dark px-3 py-2 rounded transition-colors"
          >
            Skip Tour
          </button>
          
          {currentStepIndex > 0 && (
            <button 
              onClick={onPrev}
              className="text-xs font-bold bg-white border border-gray-200 text-dark hover:bg-gray-50 px-4 py-2.5 rounded-lg shadow-sm transition-colors"
            >
              Back
            </button>
          )}
          
          {currentStepIndex < totalSteps - 1 ? (
            <button 
              onClick={onNext}
              className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg shadow-md flex items-center gap-1 transition-colors"
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button 
              onClick={onFinish}
              className="text-xs font-bold bg-dark hover:bg-black text-white px-5 py-2.5 rounded-lg shadow-md flex items-center gap-1 transition-colors"
            >
              Finish <Check size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TourCard;
