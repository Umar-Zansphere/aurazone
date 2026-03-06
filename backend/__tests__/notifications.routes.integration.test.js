const request = require('supertest');

const mockBroadcastToAll = jest.fn();
const mockSendNotification = jest.fn();

jest.mock('../api/services/notification.service', () => {
    const actual = jest.requireActual('../api/services/notification.service');
    return {
        ...actual,
        broadcastToAll: mockBroadcastToAll,
        sendNotification: mockSendNotification,
    };
});

const { app } = require('../app');
const {
    prisma,
    clearDatabase,
    createAuthContext,
    createUser,
    unique,
} = require('./setup');

jest.setTimeout(60000);

describe('Notifications routes integration', () => {
    let auth;

    const asAdmin = (method, url) =>
        request(app)[method](url).set('Authorization', `Bearer ${auth.adminToken}`);

    const asCustomer = (method, url) =>
        request(app)[method](url).set('Authorization', `Bearer ${auth.customerToken}`);

    beforeEach(async () => {
        await clearDatabase();
        auth = await createAuthContext();
        mockBroadcastToAll.mockReset();
        mockSendNotification.mockReset();
        mockBroadcastToAll.mockResolvedValue({ sent: 0, failed: 0, total: 0 });
        mockSendNotification.mockResolvedValue({ sent: 0, failed: 0 });
    });

    afterAll(async () => {
        await clearDatabase();
        await prisma.$disconnect();
    });

    // ────────────────────────── VAPID KEY ──────────────────────────

    describe('GET /api/notifications/vapid-key', () => {
        it('returns VAPID public key', async () => {
            const res = await request(app).get('/api/notifications/vapid-key');
            expect(res.status).toBe(200);
            expect(res.body.publicKey).toBeDefined();
        });
    });

    // ────────────────────────── SUBSCRIBE / UNSUBSCRIBE ──────────────────────────

    describe('POST /api/notifications/subscribe', () => {
        it('subscribes authenticated user to push notifications', async () => {
            const endpoint = `https://push.test/${unique('endpoint')}`;

            const res = await asCustomer('post', '/api/notifications/subscribe')
                .send({
                    endpoint,
                    keys: { p256dh: 'testkey', auth: 'testauth' },
                });

            expect(res.status).toBe(200);

            const sub = await prisma.pushSubscription.findUnique({ where: { endpoint } });
            expect(sub).toBeTruthy();
            expect(sub.userId).toBe(auth.customer.id);
        });

        it('rejects unauthenticated subscription', async () => {
            const res = await request(app)
                .post('/api/notifications/subscribe')
                .send({ endpoint: 'https://push.test/no-auth', keys: { p256dh: 'k', auth: 'a' } });

            expect(res.status).toBe(401);
        });
    });

    describe('DELETE /api/notifications/unsubscribe', () => {
        it('unsubscribes from push notifications', async () => {
            const endpoint = `https://push.test/${unique('unsub')}`;

            await asCustomer('post', '/api/notifications/subscribe')
                .send({ endpoint, keys: { p256dh: 'k', auth: 'a' } });

            const res = await asCustomer('delete', '/api/notifications/unsubscribe')
                .send({ endpoint });

            expect(res.status).toBe(200);

            const sub = await prisma.pushSubscription.findUnique({ where: { endpoint } });
            expect(sub).toBeNull();
        });
    });

    // ────────────────────────── HISTORY (admin) ──────────────────────────

    describe('GET /api/notifications/history', () => {
        it('returns admin notification history', async () => {
            await prisma.notificationHistory.create({
                data: {
                    userId: auth.admin.id,
                    title: 'Test',
                    body: 'Test body',
                    isRead: false,
                },
            });

            const res = await asAdmin('get', '/api/notifications/history');
            expect(res.status).toBe(200);
            expect(res.body.notifications).toBeDefined();
            expect(res.body.notifications).toHaveLength(1);
        });

        it('only returns own notifications', async () => {
            await prisma.notificationHistory.create({
                data: {
                    userId: auth.customer.id,
                    title: 'Customer Notif',
                    body: 'Not for admin',
                    isRead: false,
                },
            });

            const res = await asAdmin('get', '/api/notifications/history');
            expect(res.status).toBe(200);
            expect(res.body.notifications).toHaveLength(0);
        });

        it('rejects non-admin access', async () => {
            const res = await asCustomer('get', '/api/notifications/history');
            expect(res.status).toBe(403);
        });
    });

    // ────────────────────────── UNREAD COUNT ──────────────────────────

    describe('GET /api/notifications/unread-count', () => {
        it('returns unread count', async () => {
            await prisma.notificationHistory.createMany({
                data: [
                    { userId: auth.admin.id, title: 'A', body: 'a', isRead: false },
                    { userId: auth.admin.id, title: 'B', body: 'b', isRead: false },
                    { userId: auth.admin.id, title: 'C', body: 'c', isRead: true },
                ],
            });

            const res = await asAdmin('get', '/api/notifications/unread-count');
            expect(res.status).toBe(200);
            expect(res.body.unreadCount).toBe(2);
        });
    });

    // ────────────────────────── MARK AS READ ──────────────────────────

    describe('PATCH /api/notifications/:id/read', () => {
        it('marks notification as read', async () => {
            const notif = await prisma.notificationHistory.create({
                data: {
                    userId: auth.admin.id,
                    title: 'Unread',
                    body: 'Mark me',
                    isRead: false,
                },
            });

            const res = await asAdmin('patch', `/api/notifications/${notif.id}/read`);
            expect(res.status).toBe(200);

            const dbNotif = await prisma.notificationHistory.findUnique({ where: { id: notif.id } });
            expect(dbNotif.isRead).toBe(true);
        });
    });

    // ────────────────────────── PREFERENCES ──────────────────────────

    describe('GET /api/notifications/preferences', () => {
        it('returns default preferences', async () => {
            const res = await asAdmin('get', '/api/notifications/preferences');
            expect(res.status).toBe(200);
            expect(res.body).toEqual(expect.objectContaining({
                newOrders: expect.any(Boolean),
                orderStatusChange: expect.any(Boolean),
                lowStock: expect.any(Boolean),
                otherEvents: expect.any(Boolean),
            }));
        });
    });

    describe('POST /api/notifications/preferences', () => {
        it('updates notification preferences', async () => {
            const res = await asAdmin('post', '/api/notifications/preferences')
                .send({
                    newOrders: false,
                    orderStatusChange: true,
                    lowStock: false,
                    otherEvents: true,
                });

            expect(res.status).toBe(200);

            const dbPrefs = await prisma.notificationPreferences.findUnique({
                where: { userId: auth.admin.id },
            });
            expect(dbPrefs.newOrders).toBe(false);
            expect(dbPrefs.lowStock).toBe(false);
        });

        it('rejects empty preferences update', async () => {
            const res = await asAdmin('post', '/api/notifications/preferences').send({});
            expect(res.status).toBe(400);
        });
    });

    // ────────────────────────── SEND NOTIFICATION ──────────────────────────

    describe('POST /api/notifications/send', () => {
        it('sends notification to a specific user', async () => {
            const endpoint = `https://push.test/${unique('send-target')}`;
            await prisma.pushSubscription.create({
                data: {
                    endpoint,
                    p256dh: 'key',
                    auth: 'auth',
                    userId: auth.customer.id,
                },
            });

            const res = await asAdmin('post', '/api/notifications/send')
                .send({
                    userId: auth.customer.id,
                    title: 'Targeted Notification',
                    body: 'This is for you',
                });

            expect(res.status).toBe(200);
        });

        it('rejects non-admin access', async () => {
            const res = await asCustomer('post', '/api/notifications/send')
                .send({
                    userId: auth.customer.id,
                    title: 'Hack',
                    body: 'Not allowed',
                });

            expect(res.status).toBe(403);
        });
    });

    // ────────────────────────── BROADCAST ──────────────────────────

    describe('POST /api/notifications/broadcast', () => {
        it('broadcasts notification to all users', async () => {
            mockBroadcastToAll.mockResolvedValueOnce({ sent: 1, failed: 0, total: 1 });

            const res = await asAdmin('post', '/api/notifications/broadcast')
                .send({
                    title: 'Broadcast Test',
                    body: 'Hello everyone',
                });

            expect(res.status).toBe(200);
            expect(mockBroadcastToAll).toHaveBeenCalledTimes(1);
        });

        it('rejects non-admin broadcast', async () => {
            const res = await asCustomer('post', '/api/notifications/broadcast')
                .send({
                    title: 'Spam',
                    body: 'Not allowed',
                });

            expect(res.status).toBe(403);
        });
    });

    // ────────────────────────── TEST NOTIFICATION ──────────────────────────

    describe('POST /api/notifications/test', () => {
        it('sends test notification to self', async () => {
            const endpoint = `https://push.test/${unique('test-self')}`;
            await prisma.pushSubscription.create({
                data: {
                    endpoint,
                    p256dh: 'key',
                    auth: 'auth',
                    userId: auth.admin.id,
                },
            });

            const res = await asAdmin('post', '/api/notifications/test');
            expect(res.status).toBe(200);
        });

        it('rejects non-admin access', async () => {
            const res = await asCustomer('post', '/api/notifications/test');
            expect(res.status).toBe(403);
        });
    });
});
