// auth.middleware.js

const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');
const { getOrCreateSession } = require('../services/session.services');

const GUEST_SESSION_COOKIE_NAME = 'guestSessionId';
const GUEST_SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const setGuestSessionCookie = (res, sessionId) => {
  res.cookie(GUEST_SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: GUEST_SESSION_COOKIE_MAX_AGE_MS,
  });
};

const verifyToken = async (req, res, next) => {
  let token;
    token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        is_active: true,
        role: true,
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }

    // Attach complete user object with role information
    req.user = user;

    next();
  } catch (error) {
    // If the access token is expired, the client should use the refresh token
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Unauthorized: Token expired' });
    }
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

/**
 * Optional authentication middleware - allows both authenticated and guest users
 * Attaches user if token is valid, otherwise continues without user
 */
const optionalAuth = async (req, res, next) => {
  let token;
    token = req.cookies.accessToken;

  // If no token, continue as guest
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        is_active: true,
        role: true,
        email: true,
        phone: true,
        fullName: true,
      }
    });

    if (user) {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch (error) {
    // Invalid or expired token - continue as guest
    req.user = null;
  }

  next();
};

/**
 * Generate and manage guest session ID
 * If no session ID provided, generates one and sets it in cookie
 * Attaches sessionId to request for later use
 */
const manageGuestSession = async (req, res, next) => {
  try {
    // If user is authenticated, skip guest session
    if (req.user && req.user.id) {
      req.sessionId = null;
      return next();
    }

    // Try to get session ID from header or cookie
    let sessionId = req.headers['x-session-id'] || req.cookies[GUEST_SESSION_COOKIE_NAME];

    // Resolve (or recover) the guest session in DB
    const session = await getOrCreateSession(sessionId);
    const resolvedSessionId = session.sessionId;

    // Keep cookie in sync when:
    // - there was no incoming cookie/header
    // - session was rotated/recovered in service
    if (!sessionId || sessionId !== resolvedSessionId || req.cookies[GUEST_SESSION_COOKIE_NAME] !== resolvedSessionId) {
      setGuestSessionCookie(res, resolvedSessionId);
    }

    req.sessionId = resolvedSessionId;
    req.guestSessionDbId = session.id;

    next();
  } catch (error) {
    console.error('Error in manageGuestSession:', error);
    next(error);
  }
};

/**
 * Extract session ID from request (header or cookie)
 * Now primarily used as fallback if manageGuestSession is not in middleware chain
 * @deprecated Use manageGuestSession instead
 */
const extractSession = (req, res, next) => {
  const sessionId = req.headers['x-session-id'] || req.cookies[GUEST_SESSION_COOKIE_NAME];
  req.sessionId = sessionId || null;
  next();
};

/**
 * Require either authentication or valid session
 */
const requireAuthOrSession = async (req, res, next) => {
  // First try to authenticate
  await optionalAuth(req, res, () => { });

  // Extract session
  extractSession(req, res, () => { });

  // Check if we have either user or session
  if (!req.user && !req.sessionId) {
    return res.status(401).json({
      message: 'Unauthorized: Please login or provide a valid session',
      toast: {
        type: 'error',
        message: 'Please login or start a new session'
      }
    });
  }

  next();
};

module.exports = {
  verifyToken,
  optionalAuth,
  manageGuestSession,
  extractSession,
  requireAuthOrSession
};
