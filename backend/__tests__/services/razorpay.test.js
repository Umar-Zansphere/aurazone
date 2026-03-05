/**
 * Unit tests for api/services/razorpay.services.js
 * Tests Razorpay order creation, payment verification, webhook handling
 */
const crypto = require('crypto');

jest.mock('../../config/prisma', () => {
    const { createMockPrisma } = require('../setup');
    return createMockPrisma();
});

jest.mock('razorpay', () => {
    return jest.fn().mockImplementation(() => ({
        orders: {
            create: jest.fn().mockResolvedValue({ id: 'order_test_123', amount: 10000, currency: 'INR' }),
        },
        payments: {
            fetch: jest.fn().mockResolvedValue({ id: 'pay_test_123', status: 'captured', amount: 10000 }),
            capture: jest.fn().mockResolvedValue({ id: 'pay_test_123', status: 'captured' }),
            refund: jest.fn().mockResolvedValue({ id: 'rfnd_test_123' }),
        },
    }));
});

jest.mock('../../api/services/notification.service', () => ({
    notifyAdmins: jest.fn().mockResolvedValue(true),
    notifyNewOrder: jest.fn().mockResolvedValue(true),
    notifyOrderStatusChange: jest.fn().mockResolvedValue(true),
    notifyLowStock: jest.fn().mockResolvedValue(true),
    sendToUser: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }),
    initializeWebPush: jest.fn(),
}));

const prisma = require('../../config/prisma');
const razorpayService = require('../../api/services/razorpay.services');

describe('Razorpay Service', () => {
    describe('createRazorpayOrder', () => {
        it('should create a Razorpay order', async () => {
            const result = await razorpayService.createRazorpayOrder({
                amount: 100,
                currency: 'INR',
                receipt: 'receipt_1',
            });
            expect(result).toBeDefined();
            expect(result.id).toBe('order_test_123');
        });

        it('should pass notes to Razorpay', async () => {
            const result = await razorpayService.createRazorpayOrder({
                amount: 200,
                currency: 'INR',
                receipt: 'receipt_2',
                notes: { orderId: 'local-1' },
            });
            expect(result).toBeDefined();
        });
    });

    describe('verifyPaymentSignature', () => {
        it('should verify a valid payment signature', async () => {
            const orderId = 'order_test_123';
            const paymentId = 'pay_test_123';
            const secret = process.env.RAZORPAY_KEY_SECRET;
            const body = `${orderId}|${paymentId}`;
            const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

            const result = await razorpayService.verifyPaymentSignature({
                razorpayOrderId: orderId,
                razorpayPaymentId: paymentId,
                razorpaySignature: expectedSignature,
            });
            expect(result.isValid).toBe(true);
        });

        it('should reject an invalid payment signature', async () => {
            const result = await razorpayService.verifyPaymentSignature({
                razorpayOrderId: 'order_test_123',
                razorpayPaymentId: 'pay_test_123',
                razorpaySignature: 'invalid-signature',
            });
            expect(result.isValid).toBe(false);
        });
    });

    describe('getPaymentDetails', () => {
        it('should fetch payment details', async () => {
            const result = await razorpayService.getPaymentDetails('pay_test_123');
            expect(result).toBeDefined();
            expect(result.id).toBe('pay_test_123');
        });
    });

    describe('capturePayment', () => {
        it('should capture a payment', async () => {
            const result = await razorpayService.capturePayment('pay_test_123', 10000);
            expect(result).toBeDefined();
        });
    });

    describe('validateWebhookSignature', () => {
        it('should validate a correct webhook signature', () => {
            const body = JSON.stringify({ event: 'payment.captured' });
            const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
            const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
            const result = razorpayService.validateWebhookSignature(body, signature);
            expect(result).toBe(true);
        });

        it('should reject an incorrect webhook signature', () => {
            const result = razorpayService.validateWebhookSignature('{"event":"test"}', 'bad-sig');
            expect(result).toBe(false);
        });
    });

    describe('processPaymentWebhook', () => {
        it('should process payment.captured event', async () => {
            const result = await razorpayService.processPaymentWebhook({
                event: 'payment.captured',
                payload: {
                    payment: {
                        entity: {
                            id: 'pay_test_123',
                            order_id: 'order_test_123',
                            amount: 10000,
                            status: 'captured',
                            notes: {},
                        },
                    },
                },
            });
            expect(result).toBeDefined();
        });

        it('should handle unknown event types gracefully', async () => {
            const result = await razorpayService.processPaymentWebhook({
                event: 'unknown.event',
                payload: {},
            });
            expect(result).toBeDefined();
        });
    });
});
