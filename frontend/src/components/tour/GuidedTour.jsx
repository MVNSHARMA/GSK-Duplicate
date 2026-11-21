import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTour } from './TourContext';
import { TOUR_DEFINITIONS } from './tourDefinitions';
import TourOverlay from './TourOverlay';
import TourCard from './TourCard';

const GuidedTour = () => {
  const { isTourActive, activeTourId, currentStepIndex, stopTour, nextStep, prevStep, skipStep } = useTour();
  const [targetRect, setTargetRect] = useState(null);
  const [displayedStep, setDisplayedStep] = useState(null);
  
  const tourDef = activeTourId ? TOUR_DEFINITIONS[activeTourId] : null;
  const currentStep = tourDef ? tourDef.steps[currentStepIndex] : null;

  const transitionTimeoutRef = useRef(null);
  const findingTargetRef = useRef(false);

  const updateTargetRect = useCallback(() => {
    if (!currentStep || !displayedStep) {
      return;
    }
    const el = document.querySelector(currentStep.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(prev => {
        if (!prev || prev.top !== rect.top || prev.left !== rect.left || prev.width !== rect.width || prev.height !== rect.height) {
          return rect;
        }
        return prev;
      });
    }
  }, [currentStep, displayedStep]);

  useEffect(() => {
    if (!isTourActive || !currentStep) {
      setDisplayedStep(null);
      setTargetRect(null);
      return;
    }

    // Step 1: Hide old explanation and highlight cleanly
    setDisplayedStep(null);
    setTargetRect(null);
    findingTargetRef.current = true;
    
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    let retries = 0;
    const maxRetries = 10; // Try for 2 seconds (10 * 200ms)

    const findAndScroll = () => {
      const el = document.querySelector(currentStep.target);
      
      if (!el) {
        if (retries < maxRetries) {
          retries++;
          transitionTimeoutRef.current = setTimeout(findAndScroll, 200);
        } else {
          // Fallback: Skip if target not found after retries (e.g. user role missing feature)
          findingTargetRef.current = false;
          skipStep();
        }
        return;
      }

      findingTargetRef.current = false;
      
      // Calculate if it's comfortably in view, accounting for fixed headers and mobile nav
      const rect = el.getBoundingClientRect();
      const isInViewport = (
        rect.top >= 80 &&
        rect.left >= 20 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) - 80 &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) - 20
      );

      if (!isInViewport) {
        // Scroll target into view, centering it both vertically and horizontally (for tabs)
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        
        // Wait for smooth scroll to finish before highlighting and showing explanation
        transitionTimeoutRef.current = setTimeout(() => {
          const updatedRect = el.getBoundingClientRect();
          setTargetRect(updatedRect);
          setDisplayedStep(currentStep);
        }, 600); // 600ms allows most native scrolling to settle
      } else {
        // Already in view, show immediately
        setTargetRect(rect);
        setDisplayedStep(currentStep);
      }
    };

    findAndScroll();

    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [currentStep, isTourActive, skipStep]);

  useEffect(() => {
    if (!isTourActive || !displayedStep) return;

    let rafId;
    const handleScrollResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateTargetRect();
      });
    };

    window.addEventListener('resize', handleScrollResize);
    window.addEventListener('scroll', handleScrollResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollResize);
      window.removeEventListener('scroll', handleScrollResize, true);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isTourActive, displayedStep, updateTargetRect]);

  // Accessibility: focus trap on mount
  useEffect(() => {
    if (isTourActive) {
      const prevFocus = document.activeElement;
      
      return () => {
        if (prevFocus && typeof prevFocus.focus === 'function') {
          try { prevFocus.focus(); } catch (e) {}
        }
      };
    }
  }, [isTourActive]);

  if (!isTourActive || !tourDef || !currentStep) return null;

  return (
    <>
      <TourOverlay targetRect={targetRect} />
      {targetRect && displayedStep && (
        <TourCard
          step={displayedStep}
          currentStepIndex={currentStepIndex}
          totalSteps={tourDef.steps.length}
          onNext={() => nextStep(tourDef.steps.length)}
          onPrev={prevStep}
          onSkip={stopTour}
          onFinish={stopTour}
          targetRect={targetRect}
        />
      )}
    </>
  );
};

export default GuidedTour;
