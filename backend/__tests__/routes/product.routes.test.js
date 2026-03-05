/**
 * Integration tests for Product routes (/api/products)
 * Tests all 11 customer-facing product endpoints via Supertest
 */
const request = require('supertest');

jest.mock('../../config/prisma', () => {
    const { createMockPrisma } = require('../setup');
    return createMockPrisma();
});
jest.mock('../../config/email', () => ({ sendEmail: jest.fn() }));
jest.mock('../../api/services/notification.service', () => ({
    initializeWebPush: jest.fn(),
    sendPushNotification: jest.fn(), sendToUser: jest.fn(), sendToSession: jest.fn(),
    broadcastToAll: jest.fn(), cleanupExpiredSubscriptions: jest.fn(),
    saveSubscription: jest.fn(), removeSubscription: jest.fn(),
    notifyAdmins: jest.fn(), notifyNewOrder: jest.fn(),
    notifyOrderStatusChange: jest.fn(), notifyLowStock: jest.fn(),
}));
jest.mock('../../api/services/s3.services', () => ({
    uploadInMemory: { any: () => (r, s, n) => n(), single: () => (r, s, n) => n() },
    uploadBufferToS3: jest.fn(), uploadProductImage: { any: () => (r, s, n) => n() },
}));
jest.mock('../../api/services/product.services');
jest.mock('../../api/services/session.services', () => ({
    getOrCreateSession: jest.fn().mockResolvedValue({ id: 'db-1', sessionId: 's-1', expiresAt: new Date(Date.now() + 86400000) }),
    validateSession: jest.fn(), migrateSessionToUser: jest.fn(), cleanupExpiredSessions: jest.fn(),
}));

const app = require('../testApp');
const productService = require('../../api/services/product.services');

describe('Product Routes', () => {
    describe('GET /api/products/filters/options', () => {
        it('should return filter options', async () => {
            productService.getFilterOptions.mockResolvedValue({
                brands: ['Nike'], categories: ['SNEAKERS'], genders: ['MEN'], colors: ['Black'], sizes: ['42'],
            });
            const res = await request(app).get('/api/products/filters/options');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.brands).toBeDefined();
        });
    });

    describe('GET /api/products/popular', () => {
        it('should return popular products', async () => {
            productService.getPopularProducts.mockResolvedValue({ products: [], total: 0 });
            const res = await request(app).get('/api/products/popular');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('GET /api/products/brand/:brandName', () => {
        it('should return products by brand', async () => {
            productService.getProductsByBrand.mockResolvedValue({ products: [], total: 0 });
            const res = await request(app).get('/api/products/brand/Nike');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('GET /api/products/category/:categoryName', () => {
        it('should return products by category', async () => {
            productService.getProductsByCategory.mockResolvedValue({ products: [], total: 0 });
            const res = await request(app).get('/api/products/category/SNEAKERS');
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/products/gender/:genderName', () => {
        it('should return products by gender', async () => {
            productService.getProductsByGender.mockResolvedValue({ products: [], total: 0 });
            const res = await request(app).get('/api/products/gender/MEN');
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/products/color/:colorName', () => {
        it('should return products by color', async () => {
            productService.getProductsByColor.mockResolvedValue({ products: [], total: 0 });
            const res = await request(app).get('/api/products/color/Black');
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/products/size/:sizeValue', () => {
        it('should return products by size', async () => {
            productService.getProductsBySize.mockResolvedValue({ products: [], total: 0 });
            const res = await request(app).get('/api/products/size/42');
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/products/model/:modelNumber', () => {
        it('should return products by model', async () => {
            productService.getProductsByModel.mockResolvedValue({ products: [], total: 0 });
            const res = await request(app).get('/api/products/model/TSN-001');
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/products/search', () => {
        it('should search products with filters', async () => {
            productService.searchProducts.mockResolvedValue({ products: [], total: 0 });
            const res = await request(app).get('/api/products/search').query({ search: 'sneaker', category: 'SNEAKERS' });
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/products', () => {
        it('should return products list', async () => {
            productService.getProductsList.mockResolvedValue({ products: [], total: 0 });
            const res = await request(app).get('/api/products');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('GET /api/products/:productId', () => {
        it('should return product detail', async () => {
            productService.getProductDetail.mockResolvedValue({
                id: 'p1', name: 'Test', brand: 'Nike', variants: [],
            });
            const res = await request(app).get('/api/products/p1');
            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe('p1');
        });

        it('should return 404 for product not found', async () => {
            productService.getProductDetail.mockRejectedValue(new Error('Product not found'));
            const res = await request(app).get('/api/products/nonexistent');
            expect(res.status).toBe(404);
        });
    });
});
