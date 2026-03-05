/**
 * Unit tests for api/middleware/auth.middleware.js
 * Tests verifyToken, optionalAuth, manageGuestSession, extractSession, requireAuthOrSession
 */
const jwt = require('jsonwebtoken');
const { createMockReq, createMockRes, createMockNext, JWT_SECRET, MOCK_USER } = require('../setup');

// Mock dependencies
jest.mock('../../config/prisma', () => {
    const { createMockPrisma } = require('../setup');
    return createMockPrisma();
});

jest.mock('../../api/services/session.services', () => ({
    getOrCreateSession: jest.fn(),
}));

const prisma = require('../../config/prisma');
const sessionService = require('../../api/services/session.services');
const {
    verifyToken,
    optionalAuth,
    manageGuestSession,
    extractSession,
    requireAuthOrSession,
} = require('../../api/middleware/auth.middleware');

describe('verifyToken', () => {
    it('should return 401 when no token is provided', async () => {
        const req = createMockReq();
        const res = createMockRes();
        const next = createMockNext();
        await verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized: No token provided' });
    });

    it('should return 401 for invalid token', async () => {
        const req = createMockReq({ cookies: { accessToken: 'invalid-token' } });
        const res = createMockRes();
        const next = createMockNext();
        await verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 for expired token', async () => {
        const token = jwt.sign({ id: 'test' }, JWT_SECRET, { expiresIn: '-1s' });
        const req = createMockReq({ cookies: { accessToken: token } });
        const res = createMockRes();
        const next = createMockNext();
        await verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized: Token expired' });
    });

    it('should return 401 when user not found in DB', async () => {
        const token = jwt.sign({ id: 'nonexistent' }, JWT_SECRET, { expiresIn: '1h' });
        const req = createMockReq({ cookies: { accessToken: token } });
        const res = createMockRes();
        const next = createMockNext();
        prisma.user.findUnique.mockResolvedValue(null);
        await verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized: User not found' });
    });

    it('should set req.user and call next for valid token', async () => {
        const token = jwt.sign({ id: MOCK_USER.id }, JWT_SECRET, { expiresIn: '1h' });
        const req = createMockReq({ cookies: { accessToken: token } });
        const res = createMockRes();
        const next = createMockNext();
        prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER' });
        await verifyToken(req, res, next);
        expect(req.user).toEqual({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER' });
        expect(next).toHaveBeenCalled();
    });
});

describe('optionalAuth', () => {
    it('should set req.user to null when no token', async () => {
        const req = createMockReq();
        const res = createMockRes();
        const next = createMockNext();
        await optionalAuth(req, res, next);
        expect(req.user).toBeNull();
        expect(next).toHaveBeenCalled();
    });

    it('should set req.user when valid token', async () => {
        const token = jwt.sign({ id: MOCK_USER.id }, JWT_SECRET, { expiresIn: '1h' });
        const req = createMockReq({ cookies: { accessToken: token } });
        const res = createMockRes();
        const next = createMockNext();
        prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER', email: MOCK_USER.email, phone: MOCK_USER.phone, fullName: MOCK_USER.fullName });
        await optionalAuth(req, res, next);
        expect(req.user).not.toBeNull();
        expect(req.user.id).toBe(MOCK_USER.id);
        expect(next).toHaveBeenCalled();
    });

    it('should set req.user to null for invalid token', async () => {
        const req = createMockReq({ cookies: { accessToken: 'bad-token' } });
        const res = createMockRes();
        const next = createMockNext();
        await optionalAuth(req, res, next);
        expect(req.user).toBeNull();
        expect(next).toHaveBeenCalled();
    });

    it('should set req.user to null when user not found', async () => {
        const token = jwt.sign({ id: 'nonexistent' }, JWT_SECRET, { expiresIn: '1h' });
        const req = createMockReq({ cookies: { accessToken: token } });
        const res = createMockRes();
        const next = createMockNext();
        prisma.user.findUnique.mockResolvedValue(null);
        await optionalAuth(req, res, next);
        expect(req.user).toBeNull();
        expect(next).toHaveBeenCalled();
    });
});

describe('manageGuestSession', () => {
    it('should skip session management for authenticated users', async () => {
        const req = createMockReq({ user: { id: 'user-1' } });
        const res = createMockRes();
        const next = createMockNext();
        await manageGuestSession(req, res, next);
        expect(req.sessionId).toBeNull();
        expect(next).toHaveBeenCalled();
    });

    it('should create new session when none exists', async () => {
        const req = createMockReq();
        const res = createMockRes();
        const next = createMockNext();
        sessionService.getOrCreateSession.mockResolvedValue({
            id: 'db-session-1',
            sessionId: 'session-abc',
        });
        await manageGuestSession(req, res, next);
        expect(req.sessionId).toBe('session-abc');
        expect(req.guestSessionDbId).toBe('db-session-1');
        expect(res.cookie).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });

    it('should reuse existing session from cookie', async () => {
        const req = createMockReq({
            cookies: { guestSessionId: 'session-abc' },
        });
        const res = createMockRes();
        const next = createMockNext();
        sessionService.getOrCreateSession.mockResolvedValue({
            id: 'db-session-1',
            sessionId: 'session-abc',
        });
        await manageGuestSession(req, res, next);
        expect(req.sessionId).toBe('session-abc');
        expect(next).toHaveBeenCalled();
    });

    it('should pass errors to next on failure', async () => {
        const req = createMockReq();
        const res = createMockRes();
        const next = createMockNext();
        const error = new Error('Session DB error');
        sessionService.getOrCreateSession.mockRejectedValue(error);
        await manageGuestSession(req, res, next);
        expect(next).toHaveBeenCalledWith(error);
    });
});

describe('extractSession', () => {
    it('should extract session from x-session-id header', () => {
        const req = createMockReq({ headers: { 'x-session-id': 'header-session' } });
        const res = createMockRes();
        const next = createMockNext();
        extractSession(req, res, next);
        expect(req.sessionId).toBe('header-session');
        expect(next).toHaveBeenCalled();
    });

    it('should extract session from cookie', () => {
        const req = createMockReq({ cookies: { guestSessionId: 'cookie-session' } });
        const res = createMockRes();
        const next = createMockNext();
        extractSession(req, res, next);
        expect(req.sessionId).toBe('cookie-session');
        expect(next).toHaveBeenCalled();
    });

    it('should set sessionId to null when no session', () => {
        const req = createMockReq();
        const res = createMockRes();
        const next = createMockNext();
        extractSession(req, res, next);
        expect(req.sessionId).toBeNull();
        expect(next).toHaveBeenCalled();
    });
});

describe('requireAuthOrSession', () => {
    it('should return 401 when both user and session are missing', async () => {
        const req = createMockReq();
        const res = createMockRes();
        const next = createMockNext();
        await requireAuthOrSession(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should call next when user is authenticated', async () => {
        const token = jwt.sign({ id: MOCK_USER.id }, JWT_SECRET, { expiresIn: '1h' });
        const req = createMockReq({ cookies: { accessToken: token } });
        const res = createMockRes();
        const next = createMockNext();
        prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER', email: MOCK_USER.email, phone: MOCK_USER.phone, fullName: MOCK_USER.fullName });
        await requireAuthOrSession(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.user).not.toBeNull();
    });

    it('should call next when session is present', async () => {
        const req = createMockReq({
            headers: { 'x-session-id': 'valid-session' },
        });
        const res = createMockRes();
        const next = createMockNext();
        await requireAuthOrSession(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.sessionId).toBe('valid-session');
    });
});
