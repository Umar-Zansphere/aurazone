const request = require('supertest');

jest.mock('../api/services/notification.service', () => {
    const actual = jest.requireActual('../api/services/notification.service');
    return { ...actual, broadcastToAll: jest.fn() };
});

const { app } = require('../app');
const {
    prisma,
    clearDatabase,
    createProductFixture,
    unique,
} = require('./setup');

jest.setTimeout(60000);

describe('Product routes integration (customer-facing)', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    afterAll(async () => {
        await clearDatabase();
        await prisma.$disconnect();
    });

    // ────────────────────────── PRODUCTS LIST ──────────────────────────

    describe('GET /api/products', () => {
        it('returns empty product list when no products exist', async () => {
            const res = await request(app).get('/api/products');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('returns products when they exist', async () => {
            await createProductFixture({ category: 'RUNNING', gender: 'MEN' });
            await createProductFixture({ category: 'CASUAL', gender: 'WOMEN' });

            const res = await request(app).get('/api/products');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // ────────────────────────── PRODUCT DETAIL ──────────────────────────

    describe('GET /api/products/:productId', () => {
        it('returns product detail with variants', async () => {
            const { product } = await createProductFixture();

            const res = await request(app).get(`/api/products/${product.id}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(product.id);
        });

        it('returns 404 for non-existent product', async () => {
            const res = await request(app).get('/api/products/nonexistent-id');
            expect(res.status).toBe(404);
        });
    });

    // ────────────────────────── FILTER OPTIONS ──────────────────────────

    describe('GET /api/products/filters/options', () => {
        it('returns filter options', async () => {
            await createProductFixture({ category: 'RUNNING', gender: 'MEN' });

            const res = await request(app).get('/api/products/filters/options');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
        });
    });

    // ────────────────────────── POPULAR PRODUCTS ──────────────────────────

    describe('GET /api/products/popular', () => {
        it('returns popular products', async () => {
            await createProductFixture();
            const res = await request(app).get('/api/products/popular');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // ────────────────────────── BY BRAND ──────────────────────────

    describe('GET /api/products/brand/:brandName', () => {
        it('returns products by brand', async () => {
            await createProductFixture();
            const res = await request(app).get('/api/products/brand/AuraZone');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('returns empty for non-existent brand', async () => {
            const res = await request(app).get('/api/products/brand/NonExistentBrand');
            expect(res.status).toBe(200);
        });
    });

    // ────────────────────────── BY CATEGORY ──────────────────────────

    describe('GET /api/products/category/:categoryName', () => {
        it('returns products by category', async () => {
            await createProductFixture({ category: 'RUNNING' });
            const res = await request(app).get('/api/products/category/RUNNING');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('returns empty for unused category', async () => {
            const res = await request(app).get('/api/products/category/FORMAL');
            expect(res.status).toBe(200);
        });
    });

    // ────────────────────────── BY GENDER ──────────────────────────

    describe('GET /api/products/gender/:genderName', () => {
        it('returns products by gender', async () => {
            await createProductFixture({ gender: 'MEN' });
            const res = await request(app).get('/api/products/gender/MEN');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // ────────────────────────── BY COLOR ──────────────────────────

    describe('GET /api/products/color/:colorName', () => {
        it('returns products by color', async () => {
            await createProductFixture();
            // fixture creates variant with color "Black"
            const res = await request(app).get('/api/products/color/Black');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // ────────────────────────── BY SIZE ──────────────────────────

    describe('GET /api/products/size/:sizeValue', () => {
        it('returns products by size', async () => {
            await createProductFixture();
            // fixture creates variant with size "9"
            const res = await request(app).get('/api/products/size/9');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // ────────────────────────── SEARCH ──────────────────────────

    describe('GET /api/products/search', () => {
        it('searches by query text', async () => {
            await createProductFixture();
            const res = await request(app).get('/api/products/search?search=Runner');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('applies multiple filters simultaneously', async () => {
            await createProductFixture({ category: 'RUNNING', gender: 'MEN' });
            const res = await request(app).get(
                '/api/products/search?category=RUNNING&gender=MEN&minPrice=1000&maxPrice=5000'
            );
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('returns empty for nonsense search', async () => {
            const res = await request(app).get('/api/products/search?search=xyznonexistent99');
            expect(res.status).toBe(200);
        });
    });

    // ────────────────────────── BY MODEL ──────────────────────────

    describe('GET /api/products/model/:modelNumber', () => {
        it('handles non-existent model gracefully', async () => {
            const res = await request(app).get('/api/products/model/NOMODEL');
            expect(res.status).toBe(200);
        });
    });
});
