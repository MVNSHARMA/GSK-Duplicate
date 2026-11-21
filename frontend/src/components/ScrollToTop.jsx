import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Centralized global scroll restoration component.
 * Ensures that when a user navigates to a new page or view, the scroll position resets to the top.
 * Supports both the public window scroll and authenticated <main> container scroll.
 */
const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    // Explicitly override browser native scroll restoration to prevent it
    // from fighting our application-level tab/page scroll resets on Back/Forward.
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    // Use a double requestAnimationFrame to ensure React has fully committed the new DOM
    // and the browser has painted the layout before we enforce the scroll position.
    // This eliminates intermittent scroll retention caused by React 18 rendering batching.
    let raf1, raf2;
    
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        // 1. Reset public layout (window scrolling)
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;

        // 2. Reset authenticated layouts (Admin/Customer <main> scrolling)
        const mainContainers = document.querySelectorAll('main');
        mainContainers.forEach(container => {
          const overflowY = window.getComputedStyle(container).overflowY;
          if (overflowY === 'auto' || overflowY === 'scroll') {
            container.scrollTo(0, 0);
            container.scrollTop = 0;
          }
        });
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [location.pathname, location.search]); // Trigger on route OR query changes

  return null;
};

export default ScrollToTop;
