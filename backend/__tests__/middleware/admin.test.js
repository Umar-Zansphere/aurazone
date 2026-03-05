/**
 * Unit tests for api/middleware/admin.middleware.js
 * Tests extractToken, verifyToken, verifyAdmin
 */
const jwt = require('jsonwebtoken');
const { createMockReq, createMockRes, createMockNext, JWT_SECRET, MOCK_USER, MOCK_ADMIN } = require('../setup');

jest.mock('../../config/prisma', () => {
    const { createMockPrisma } = require('../setup');
    return createMockPrisma();
});

const prisma = require('../../config/prisma');
const { verifyToken, verifyAdmin } = require('../../api/middleware/admin.middleware');

describe('Admin Middleware - verifyToken', () => {
    it('should set req.user for valid Bearer token', async () => {
        const token = jwt.sign({ id: MOCK_USER.id }, JWT_SECRET, { expiresIn: '1h' });
        const req = createMockReq({
            headers: { authorization: `Bearer ${token}` },
        });
        const res = createMockRes();
        const next = createMockNext();
        prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER' });
        await verifyToken(req, res, next);
        expect(req.user.id).toBe(MOCK_USER.id);
        expect(next).toHaveBeenCalled();
    });

    it('should set req.user for valid cookie token', async () => {
        const token = jwt.sign({ id: MOCK_USER.id }, JWT_SECRET, { expiresIn: '1h' });
        const req = createMockReq({ cookies: { accessToken: token } });
        const res = createMockRes();
        const next = createMockNext();
        prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER' });
        await verifyToken(req, res, next);
        expect(req.user.id).toBe(MOCK_USER.id);
        expect(next).toHaveBeenCalled();
    });

    it('should set req.user for valid query token', async () => {
        const token = jwt.sign({ id: MOCK_USER.id }, JWT_SECRET, { expiresIn: '1h' });
        const req = createMockReq({ query: { token } });
        const res = createMockRes();
        const next = createMockNext();
        prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER' });
        await verifyToken(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should return 401 when no token provided', async () => {
        const req = createMockReq();
        const res = createMockRes();
        const next = createMockNext();
        await verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized: No token provided' });
    });

    it('should return 401 for expired token', async () => {
        const token = jwt.sign({ id: MOCK_USER.id }, JWT_SECRET, { expiresIn: '-1s' });
        const req = createMockReq({ cookies: { accessToken: token } });
        const res = createMockRes();
        const next = createMockNext();
        await verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized: Token expired' });
    });

    it('should return 401 when user not found', async () => {
        const token = jwt.sign({ id: 'ghost' }, JWT_SECRET, { expiresIn: '1h' });
        const req = createMockReq({ cookies: { accessToken: token } });
        const res = createMockRes();
        const next = createMockNext();
        prisma.user.findUnique.mockResolvedValue(null);
        await verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized: User not found' });
    });
});

describe('Admin Middleware - verifyAdmin', () => {
    it('should call next for admin user', async () => {
        const token = jwt.sign({ id: MOCK_ADMIN.id }, JWT_SECRET, { expiresIn: '1h' });
        const req = createMockReq({ cookies: { accessToken: token } });
        const res = createMockRes();
        const next = createMockNext();
        prisma.user.findUnique.mockResolvedValue({ id: MOCK_ADMIN.id, is_active: true, role: 'ADMIN' });
        await verifyAdmin(req, res, next);
        expect(req.user.role).toBe('ADMIN');
        expect(next).toHaveBeenCalled();
    });

    it('should return 403 for non-admin user', async () => {
        const token = jwt.sign({ id: MOCK_USER.id }, JWT_SECRET, { expiresIn: '1h' });
        const req = createMockReq({ cookies: { accessToken: token } });
        const res = createMockRes();
        const next = createMockNext();
        prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER' });
        await verifyAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden: Admin access required' });
    });

    it('should return 401 when no token provided', async () => {
        const req = createMockReq();
        const res = createMockRes();
        const next = createMockNext();
        await verifyAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
    });
});
