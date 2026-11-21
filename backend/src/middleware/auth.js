import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { hasPermission, requirePageAccess, getEffectivePageAccess } from "./permissions.js";

// Short-lived in-memory cache for authenticated User documents to eliminate
// redundant MongoDB Atlas roundtrips on every API request & concurrent tab loads.
const USER_CACHE_TTL_MS = 30 * 1000; // 30 seconds
const userAuthCache = new Map();

export const invalidateUserCache = (userId = null) => {
  if (userId) {
    userAuthCache.delete(String(userId));
  } else {
    userAuthCache.clear();
  }
};

/**
 * Protect middleware — verifies JWT from Authorization header.
 * Attaches user to req.user on success.
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, error: "Not authorized — no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const cacheKey = String(decoded.id);
    const now = Date.now();
    const cached = userAuthCache.get(cacheKey);

    let user;
    if (cached && cached.expiresAt > now) {
      user = cached.user;
    } else {
      user = await User.findById(decoded.id).select("-password");
      if (user && user.status !== "disabled") {
        userAuthCache.set(cacheKey, {
          user,
          expiresAt: now + USER_CACHE_TTL_MS,
        });
      } else {
        userAuthCache.delete(cacheKey);
      }
    }

    req.user = user;

    if (!req.user) {
      return res.status(401).json({ success: false, error: "Not authorized — user not found" });
    }

    if (req.user.status === "disabled") {
      return res.status(401).json({ success: false, error: "Not authorized — account is disabled" });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: "Not authorized — token invalid" });
  }
};

/**
 * Authorize roles middleware — checks if user has required role
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user ? req.user.role : 'unknown'} is not authorized to access this route`
      });
    }
    next();
  };
};

/**
 * Require permission middleware — checks if user has specific permission
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || !hasPermission(req.user, permission)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required permission: ${permission}`
      });
    }
    next();
  };
};

/**
 * Require any permission middleware — checks if user has at least one of the specified permissions
 */
export const requireAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user || !permissions.some((permission) => hasPermission(req.user, permission))) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required permission: ${permissions.join(' or ')}`
      });
    }
    next();
  };
};

/**
 * Require any page access middleware — checks if user has access to at least one of the given pages
 */
export const requireAnyPageAccess = (...pageNames) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }
    const effectivePages = getEffectivePageAccess(req.user);
    if (pageNames.some((page) => effectivePages.includes(page))) {
      return next();
    }
    return res.status(403).json({
      success: false,
      error: 'You do not have access to this page.'
    });
  };
};

// Re-export requirePageAccess for convenience
export { requirePageAccess };

export default protect;
