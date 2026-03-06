const request = require('supertest');

jest.mock('../api/services/notification.service', () => {
    const actual = jest.requireActual('../api/services/notification.service');
    return { ...actual, broadcastToAll: jest.fn() };
});

const { app } = require('../app');
const {
    prisma,
    clearDatabase,
    createAuthContext,
    createProductFixture,
    unique,
} = require('./setup');

jest.setTimeout(60000);

describe('Session routes integration', () => {
    let auth;

    beforeEach(async () => {
        await clearDatabase();
        auth = await createAuthContext();
    });

    afterAll(async () => {
        await clearDatabase();
        await prisma.$disconnect();
    });

    // ────────────────────────── CREATE SESSION ──────────────────────────

    describe('POST /api/session/create', () => {
        it('creates a new guest session', async () => {
            const res = await request(app).post('/api/session/create');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.sessionId).toBeDefined();
            expect(res.body.expiresAt).toBeDefined();
        });

        it('creates unique session IDs on successive calls', async () => {
            const res1 = await request(app).post('/api/session/create');
            const res2 = await request(app).post('/api/session/create');

            expect(res1.body.sessionId).toBeDefined();
            expect(res2.body.sessionId).toBeDefined();
            expect(res1.body.sessionId).not.toBe(res2.body.sessionId);
        });
    });

    // ────────────────────────── VALIDATE SESSION ──────────────────────────

    describe('GET /api/session/validate', () => {
        it('validates a valid session', async () => {
            const createRes = await request(app).post('/api/session/create');
            const sessionId = createRes.body.sessionId;

            const res = await request(app)
                .get('/api/session/validate')
                .set('x-session-id', sessionId);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('rejects an invalid session', async () => {
            const res = await request(app)
                .get('/api/session/validate')
                .set('x-session-id', 'nonexistent-session');

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it('returns 400 when no session id provided', async () => {
            const res = await request(app).get('/api/session/validate');
            expect(res.status).toBe(400);
        });
    });

    // ────────────────────────── MIGRATE SESSION ──────────────────────────

    describe('POST /api/session/migrate', () => {
        it('migrates guest session data to authenticated user', async () => {
            // Create session and add items
            const sessionRes = await request(app).post('/api/session/create');
            const sessionId = sessionRes.body.sessionId;

            const { variant } = await createProductFixture();

            // Add to cart as guest
            await request(app)
                .post('/api/cart')
                .set('x-session-id', sessionId)
                .send({ variantId: variant.id, quantity: 1 });

            // Migrate session to authenticated user
            const res = await request(app)
                .post('/api/session/migrate')
                .set('Authorization', `Bearer ${auth.customerToken}`)
                .set('x-session-id', sessionId);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('rejects migration without authentication', async () => {
            const sessionRes = await request(app).post('/api/session/create');
            const sessionId = sessionRes.body.sessionId;

            const res = await request(app)
                .post('/api/session/migrate')
                .set('x-session-id', sessionId);

            expect(res.status).toBe(401);
        });

        it('rejects migration without session ID', async () => {
            const res = await request(app)
                .post('/api/session/migrate')
                .set('Authorization', `Bearer ${auth.customerToken}`);

            expect(res.status).toBe(400);
        });
    });
});
