/**
 * Unit tests for api/services/session.services.js
 * Tests session generation, get/create, validation, migration, and cleanup
 */
jest.mock('../../config/prisma', () => {
    const { createMockPrisma } = require('../setup');
    return createMockPrisma();
});

const prisma = require('../../config/prisma');
const {
    generateSessionId,
    getOrCreateSession,
    validateSession,
    extendSession,
    cleanupExpiredSessions,
} = require('../../api/services/session.services');

describe('generateSessionId', () => {
    it('should return a hex string', () => {
        const id = generateSessionId();
        expect(typeof id).toBe('string');
        expect(id).toMatch(/^[a-f0-9]+$/);
    });

    it('should return unique values', () => {
        const id1 = generateSessionId();
        const id2 = generateSessionId();
        expect(id1).not.toBe(id2);
    });

    it('should return a 64 character hex (32 bytes)', () => {
        const id = generateSessionId();
        expect(id.length).toBe(64);
    });
});

describe('getOrCreateSession', () => {
    it('should create a new session when no sessionId provided', async () => {
        prisma.guestSession.create.mockResolvedValue({
            id: 'db-1',
            sessionId: 'new-session-id',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        const result = await getOrCreateSession();
        expect(result).toBeDefined();
        expect(prisma.guestSession.create).toHaveBeenCalled();
    });

    it('should return existing valid session', async () => {
        const futureDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
        prisma.guestSession.findUnique.mockResolvedValue({
            id: 'db-1',
            sessionId: 'existing-session',
            expiresAt: futureDate,
        });
        const result = await getOrCreateSession('existing-session');
        expect(result.sessionId).toBe('existing-session');
    });

    it('should create new session for unknown sessionId', async () => {
        prisma.guestSession.findUnique.mockResolvedValue(null);
        prisma.guestSession.create.mockResolvedValue({
            id: 'db-2',
            sessionId: 'brand-new',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        const result = await getOrCreateSession('unknown-session');
        expect(prisma.guestSession.create).toHaveBeenCalled();
        expect(result).toBeDefined();
    });

    it('should rotate expired session to preserve guest data', async () => {
        const expiredDate = new Date(Date.now() - 1000);
        prisma.guestSession.findUnique.mockResolvedValue({
            id: 'db-1',
            sessionId: 'expired-session',
            expiresAt: expiredDate,
        });
        prisma.guestSession.update.mockResolvedValue({
            id: 'db-1',
            sessionId: 'rotated-session',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        const result = await getOrCreateSession('expired-session');
        expect(result).toBeDefined();
        expect(prisma.guestSession.update).toHaveBeenCalled();
    });

    it('should extend near-expiry session', async () => {
        // Only 5 days remaining (threshold is 10 days)
        const nearExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
        prisma.guestSession.findUnique.mockResolvedValue({
            id: 'db-1',
            sessionId: 'near-expiry-session',
            expiresAt: nearExpiry,
        });
        prisma.guestSession.update.mockResolvedValue({
            id: 'db-1',
            sessionId: 'near-expiry-session',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        const result = await getOrCreateSession('near-expiry-session');
        expect(result.sessionId).toBe('near-expiry-session');
        expect(prisma.guestSession.update).toHaveBeenCalled();
    });
});

describe('validateSession', () => {
    it('should return true for a valid session', async () => {
        prisma.guestSession.findUnique.mockResolvedValue({
            id: 'db-1',
            sessionId: 'valid-session',
            expiresAt: new Date(Date.now() + 86400000),
        });
        const result = await validateSession('valid-session');
        expect(result).toBe(true);
    });

    it('should return false for non-existent session', async () => {
        prisma.guestSession.findUnique.mockResolvedValue(null);
        const result = await validateSession('nonexistent');
        expect(result).toBe(false);
    });

    it('should return false for expired session', async () => {
        prisma.guestSession.findUnique.mockResolvedValue({
            id: 'db-1',
            sessionId: 'expired',
            expiresAt: new Date(Date.now() - 1000), // expired
        });
        const result = await validateSession('expired');
        expect(result).toBe(false);
    });

    it('should return false for null sessionId', async () => {
        const result = await validateSession(null);
        expect(result).toBe(false);
    });
});

describe('extendSession', () => {
    it('should update session expiry', async () => {
        prisma.guestSession.update.mockResolvedValue({ id: 'db-1' });
        await extendSession('session-id');
        expect(prisma.guestSession.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { sessionId: 'session-id' },
                data: expect.objectContaining({ expiresAt: expect.any(Date) }),
            })
        );
    });
});

describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions and related data', async () => {
        prisma.guestSession.deleteMany.mockResolvedValue({ count: 2 });
        prisma.cart.deleteMany.mockResolvedValue({ count: 1 });
        prisma.wishlist.deleteMany.mockResolvedValue({ count: 0 });
        const result = await cleanupExpiredSessions();
        expect(result).toBeDefined();
        expect(result.sessionsDeleted).toBe(2);
    });
});
