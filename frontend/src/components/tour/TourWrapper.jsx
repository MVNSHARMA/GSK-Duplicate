import React, { Suspense } from 'react';
import { TourProvider } from './TourContext';

// Lazy load the actual tour engine to prevent bundle bloat for users who never start a tour
const GuidedTourLazy = React.lazy(() => import('./GuidedTour'));

const TourWrapper = ({ children }) => {
  return (
    <TourProvider>
      {children}
      <Suspense fallback={null}>
        <GuidedTourLazy />
      </Suspense>
    </TourProvider>
  );
};

export default TourWrapper;
