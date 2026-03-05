/**
 * Test Express app for Supertest integration testing.
 * Mirrors server.js but without calling .listen() and with mocked side-effects.
 */

// Set env BEFORE any imports
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NODE_ENV = 'test';
process.env.VAPID_PUBLIC_KEY = 'test-vapid-public';
process.env.VAPID_PRIVATE_KEY = 'test-vapid-private';
process.env.VAPID_EMAIL = 'test@test.com';

// Mock notification service initializeWebPush to avoid side-effects
jest.mock('../api/services/notification.service', () => ({
    initializeWebPush: jest.fn(),
    sendPushNotification: jest.fn().mockResolvedValue(true),
    sendToUser: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
    sendToSession: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
    broadcastToAll: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
    cleanupExpiredSubscriptions: jest.fn().mockResolvedValue(0),
    saveSubscription: jest.fn().mockResolvedValue({ id: 'sub-1' }),
    removeSubscription: jest.fn().mockResolvedValue(true),
    notifyAdmins: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
    notifyNewOrder: jest.fn().mockResolvedValue(true),
    notifyOrderStatusChange: jest.fn().mockResolvedValue(true),
    notifyLowStock: jest.fn().mockResolvedValue(true),
}));

// Mock Prisma
jest.mock('../config/prisma', () => {
    const { createMockPrisma } = require('./setup');
    return createMockPrisma();
});

// Mock email
jest.mock('../config/email', () => ({
    sendEmail: jest.fn().mockResolvedValue(true),
}));

// Mock S3 services
jest.mock('../api/services/s3.services', () => ({
    uploadInMemory: { any: () => (req, res, next) => next(), single: () => (req, res, next) => next() },
    uploadBufferToS3: jest.fn().mockResolvedValue('https://s3.test.com/image.jpg'),
    uploadProductImage: { any: () => (req, res, next) => next(), single: () => (req, res, next) => next() },
}));

// Mock Razorpay services
jest.mock('../api/services/razorpay.services', () => ({
    createRazorpayOrder: jest.fn().mockResolvedValue({ id: 'order_test', amount: 10000 }),
    verifyPaymentSignature: jest.fn().mockResolvedValue({ isValid: true }),
    getPaymentDetails: jest.fn().mockResolvedValue({ status: 'captured', amount: 10000 }),
    capturePayment: jest.fn().mockResolvedValue(true),
    refundPayment: jest.fn().mockResolvedValue(true),
    processPaymentWebhook: jest.fn().mockResolvedValue({ processed: true }),
    validateWebhookSignature: jest.fn().mockReturnValue(true),
    handlePaymentAuthorized: jest.fn().mockResolvedValue(true),
    handlePaymentFailed: jest.fn().mockResolvedValue(true),
    handlePaymentCaptured: jest.fn().mockResolvedValue(true),
    handleOrderPaid: jest.fn().mockResolvedValue(true),
    handleRefundCreated: jest.fn().mockResolvedValue(true),
    handleRefundProcessed: jest.fn().mockResolvedValue(true),
}));

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Import routes
const apiRoutes = require('../api/routes/index.js');
app.use('/api', apiRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Something broke!';
    res.status(statusCode).json({ message });
});

app.get('/health', async (req, res) => {
    res.json({ status: 'healthy', message: 'Database connection OK ✅' });
});

app.get('/', (req, res) => {
    res.json({ message: 'Backend running 🟢' });
});

module.exports = app;
