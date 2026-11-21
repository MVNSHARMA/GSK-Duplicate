import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasActionPermission, hasPageAccess } from '../utils/pageAccess';

const RoleRoute = ({ children, allowedRoles, pageKey, actionKey }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login but save the attempted url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if the user's role is in the allowedRoles array
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect based on current role
    if (user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'mechanic') {
      return <Navigate to="/admin" replace />;
    } else if (user?.role === 'user') {
      return <Navigate to="/customer" replace />;
    } else {
      return <Navigate to="/" replace />;
    }
  }

  if (pageKey && !hasPageAccess(user, pageKey)) {
    return <Navigate to={user?.role === 'user' ? '/customer' : '/admin'} replace />;
  }

  if (actionKey && !hasActionPermission(user, actionKey)) {
    return <Navigate to="/admin/job-cards" replace />;
  }

  return children;
};

export default RoleRoute;
