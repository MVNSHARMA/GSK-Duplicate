import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const useProtectedAction = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const requireAuth = (actionFn, fallbackState = null, storageKey = 'pendingActionData') => {
    if (isAuthenticated) {
      // User is logged in, proceed with the action
      return actionFn();
    } else {
      // User is not logged in, save their progress and redirect
      if (fallbackState) {
        sessionStorage.setItem(storageKey, JSON.stringify(fallbackState));
      }
      // Redirect to login, but tell Login to send them back here afterwards
      navigate('/login', { state: { from: location.pathname, storageKey } });
      return null;
    }
  };

  const restoreState = (storageKey = 'pendingActionData') => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      sessionStorage.removeItem(storageKey);
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved state', e);
        return null;
      }
    }
    return null;
  };

  return { requireAuth, restoreState };
};

export default useProtectedAction;
