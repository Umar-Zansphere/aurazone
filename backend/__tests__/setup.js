/**
 * Global test setup and helpers for Aurazone Backend tests.
 * Provides mock factories for Prisma, req/res/next, JWT tokens, etc.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-jwt-secret';
process.env.JWT_SECRET = JWT_SECRET;
process.env.NODE_ENV = 'test';
process.env.VAPID_PUBLIC_KEY = 'test-vapid-public';
process.env.VAPID_PRIVATE_KEY = 'test-vapid-private';
process.env.VAPID_EMAIL = 'test@test.com';
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp_webhook_secret';

// ======================== MOCK FACTORIES ========================

/**
 * Create a mock Prisma model with all common methods
 */
const createMockModel = () => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
});

/**
 * Create a complete mock Prisma client
 */
const createMockPrisma = () => ({
    user: createMockModel(),
    guestSession: createMockModel(),
    userSession: createMockModel(),
    otpVerification: createMockModel(),
    product: createMockModel(),
    productVariant: createMockModel(),
    productImage: createMockModel(),
    inventory: createMockModel(),
    inventoryLog: createMockModel(),
    cart: createMockModel(),
    cartItem: createMockModel(),
    wishlist: createMockModel(),
    wishlistItem: createMockModel(),
    order: createMockModel(),
    orderItem: createMockModel(),
    orderAddress: createMockModel(),
    orderShipment: createMockModel(),
    orderLog: createMockModel(),
    payment: createMockModel(),
    paymentLog: createMockModel(),
    shipmentLog: createMockModel(),
    pushSubscription: createMockModel(),
    notificationHistory: createMockModel(),
    notificationPreferences: createMockModel(),
    address: createMockModel(),
    $transaction: jest.fn((fn) => {
        if (typeof fn === 'function') {
            return fn(createMockPrisma());
        }
        return Promise.resolve(fn);
    }),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    $executeRaw: jest.fn().mockResolvedValue(1),
});

/**
 * Create a mock Express request object
 */
const createMockReq = (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    user: null,
    sessionId: null,
    guestSessionDbId: null,
    ...overrides,
});

/**
 * Create a mock Express response object
 */
const createMockRes = () => {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        cookie: jest.fn().mockReturnThis(),
        clearCookie: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
    };
    return res;
};

/**
 * Create a mock next function
 */
const createMockNext = () => jest.fn();

/**
 * Generate a valid JWT token for testing
 */
const generateTestToken = (payload = {}) => {
    const defaults = {
        id: 'test-user-id-123',
        role: 'CUSTOMER',
    };
    return jwt.sign({ ...defaults, ...payload }, JWT_SECRET, { expiresIn: '7d' });
};

/**
 * Generate a valid admin JWT token
 */
const generateAdminToken = (payload = {}) => {
    return generateTestToken({ role: 'ADMIN', id: 'admin-user-id-456', ...payload });
};

/**
 * Generate an expired JWT token
 */
const generateExpiredToken = (payload = {}) => {
    const defaults = { id: 'test-user-id-123', role: 'CUSTOMER' };
    return jwt.sign({ ...defaults, ...payload }, JWT_SECRET, { expiresIn: '-1s' });
};

/**
 * Standard mock user objects
 */
const MOCK_USER = {
    id: 'test-user-id-123',
    email: 'test@example.com',
    phone: '+1234567890',
    fullName: 'Test User',
    role: 'CUSTOMER',
    is_active: true,
    is_email_verified: new Date(),
    is_phone_verified: new Date(),
    password: '$2b$10$hashedpassword',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
};

const MOCK_ADMIN = {
    id: 'admin-user-id-456',
    email: 'admin@example.com',
    phone: '+0987654321',
    fullName: 'Admin User',
    role: 'ADMIN',
    is_active: true,
    is_email_verified: new Date(),
    is_phone_verified: new Date(),
    password: '$2b$10$hashedpassword',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
};

const MOCK_PRODUCT = {
    id: 'product-id-1',
    name: 'Test Sneaker',
    brand: 'TestBrand',
    category: 'SNEAKERS',
    gender: 'UNISEX',
    description: 'A test product',
    modelNumber: 'TSN-001',
    isFeatured: true,
    isActive: true,
    tags: ['test'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
};

const MOCK_VARIANT = {
    id: 'variant-id-1',
    productId: 'product-id-1',
    size: '42',
    color: 'Black',
    sku: 'TSN-001-BLK-42',
    price: 99.99,
    compareAtPrice: 129.99,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
};

const MOCK_ADDRESS = {
    id: 'address-id-1',
    userId: 'test-user-id-123',
    name: 'Home',
    phone: '+1234567890',
    addressLine1: '123 Test St',
    addressLine2: 'Apt 1',
    city: 'Test City',
    state: 'TS',
    postalCode: '12345',
    country: 'US',
    isDefault: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
};

module.exports = {
    JWT_SECRET,
    createMockPrisma,
    createMockModel,
    createMockReq,
    createMockRes,
    createMockNext,
    generateTestToken,
    generateAdminToken,
    generateExpiredToken,
    MOCK_USER,
    MOCK_ADMIN,
    MOCK_PRODUCT,
    MOCK_VARIANT,
    MOCK_ADDRESS,
};
