/**
 * Tests for src/middleware.js
 * Route protection middleware
 */
import { NextResponse } from 'next/server';
import { middleware, config } from '@/middleware';

// Reset mocks
beforeEach(() => {
    jest.clearAllMocks();
});

// Helper to create mock NextRequest
function createMockRequest(pathname, hasToken = false) {
    return {
        nextUrl: {
            pathname,
            origin: 'http://localhost:3000',
        },
        url: `http://localhost:3000${pathname}`,
        cookies: {
            get: jest.fn((name) => {
                if (name === 'token' && hasToken) return { value: 'mock-token' };
                if (name === 'accessToken' && hasToken) return { value: 'mock-token' };
                return undefined;
            }),
        },
    };
}

// ─── Auth routes when authenticated ──────────────────────────────────────────

describe('middleware - auth routes when authenticated', () => {
    test('redirects /login to / when authenticated', () => {
        const req = createMockRequest('/login', true);
        middleware(req);
        expect(NextResponse.redirect).toHaveBeenCalled();
    });

    test('redirects /signup to / when authenticated', () => {
        const req = createMockRequest('/signup', true);
        middleware(req);
        expect(NextResponse.redirect).toHaveBeenCalled();
    });

    test('redirects /verify-otp to / when authenticated', () => {
        const req = createMockRequest('/verify-otp', true);
        middleware(req);
        expect(NextResponse.redirect).toHaveBeenCalled();
    });

    test('redirects /forgot-password to / when authenticated', () => {
        const req = createMockRequest('/forgot-password', true);
        middleware(req);
        expect(NextResponse.redirect).toHaveBeenCalled();
    });

    test('redirects /verify-email to / when authenticated', () => {
        const req = createMockRequest('/verify-email', true);
        middleware(req);
        expect(NextResponse.redirect).toHaveBeenCalled();
    });
});

// ─── Auth routes when not authenticated ──────────────────────────────────────

describe('middleware - auth routes when not authenticated', () => {
    test('allows /login when not authenticated', () => {
        const req = createMockRequest('/login', false);
        middleware(req);
        expect(NextResponse.next).toHaveBeenCalled();
    });

    test('allows /signup when not authenticated', () => {
        const req = createMockRequest('/signup', false);
        middleware(req);
        expect(NextResponse.next).toHaveBeenCalled();
    });
});

// ─── Normal routes ──────────────────────────────────────────────────────────

describe('middleware - normal routes', () => {
    test('allows / for authenticated users', () => {
        const req = createMockRequest('/', true);
        middleware(req);
        expect(NextResponse.next).toHaveBeenCalled();
    });

    test('allows / for unauthenticated users', () => {
        const req = createMockRequest('/', false);
        middleware(req);
        expect(NextResponse.next).toHaveBeenCalled();
    });

    test('allows /products for unauthenticated users', () => {
        const req = createMockRequest('/products', false);
        middleware(req);
        expect(NextResponse.next).toHaveBeenCalled();
    });

    test('allows /cart for unauthenticated users', () => {
        const req = createMockRequest('/cart', false);
        middleware(req);
        expect(NextResponse.next).toHaveBeenCalled();
    });
});

// ─── Config matcher ──────────────────────────────────────────────────────────

describe('middleware config', () => {
    test('has a matcher array', () => {
        expect(config.matcher).toBeDefined();
        expect(Array.isArray(config.matcher)).toBe(true);
    });
});
