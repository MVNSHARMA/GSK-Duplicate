import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const TourContext = createContext(null);

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};

export const TourProvider = ({ children }) => {
  const [activeTourId, setActiveTourId] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTourActive, setIsTourActive] = useState(false);

  const startTour = useCallback((tourId) => {
    setActiveTourId(tourId);
    setCurrentStepIndex(0);
    setIsTourActive(true);
    // Mark as seen when they start a tour voluntarily (usually the overview)
    if (tourId === 'admin-overview') {
      localStorage.setItem('gsk_admin_tour_seen', 'true');
    }
  }, []);

  const stopTour = useCallback(() => {
    setActiveTourId(null);
    setCurrentStepIndex(0);
    setIsTourActive(false);
  }, []);

  const nextStep = useCallback((maxSteps) => {
    setCurrentStepIndex((prev) => {
      if (prev >= maxSteps - 1) {
        stopTour();
        return prev;
      }
      return prev + 1;
    });
  }, [stopTour]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  }, []);
  
  const skipStep = useCallback(() => {
    setCurrentStepIndex((prev) => prev + 1);
  }, []);

  return (
    <TourContext.Provider
      value={{
        isTourActive,
        activeTourId,
        currentStepIndex,
        startTour,
        stopTour,
        nextStep,
        prevStep,
        skipStep
      }}
    >
      {children}
    </TourContext.Provider>
  );
};
