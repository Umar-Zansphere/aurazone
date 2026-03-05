/**
 * Unit tests for api/utils/admin.utils.js
 * Tests all parser functions, pagination, timeline builders, and utility helpers
 */
const {
    ORDER_STATUSES, PAYMENT_STATUSES, SHIPMENT_STATUSES,
    PRODUCT_CATEGORIES, PRODUCT_GENDERS,
    parseBool, parseNumber, parseInteger, toNumber,
    toDateOnly, startOfUtcDay, endOfUtcDay, addDaysUtc,
    getPeriodRange, parsePagination, buildPagination,
    buildOrderStatusTimeline, parseTagsInput, parseVariantsInput,
    getCookieOptions,
} = require('../../api/utils/admin.utils');

// ======================== CONSTANTS ========================
describe('Admin Utils Constants', () => {
    it('should export correct ORDER_STATUSES', () => {
        expect(ORDER_STATUSES).toEqual(['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
    });
    it('should export correct PAYMENT_STATUSES', () => {
        expect(PAYMENT_STATUSES).toEqual(['PENDING', 'SUCCESS', 'FAILED']);
    });
    it('should export correct SHIPMENT_STATUSES', () => {
        expect(SHIPMENT_STATUSES).toEqual(['PENDING', 'SHIPPED', 'DELIVERED', 'RETURNED', 'LOST']);
    });
    it('should export correct PRODUCT_CATEGORIES', () => {
        expect(PRODUCT_CATEGORIES).toEqual(['RUNNING', 'CASUAL', 'FORMAL', 'SNEAKERS']);
    });
    it('should export correct PRODUCT_GENDERS', () => {
        expect(PRODUCT_GENDERS).toEqual(['MEN', 'WOMEN', 'UNISEX', 'KIDS']);
    });
});

// ======================== parseBool ========================
describe('parseBool', () => {
    it('should return boolean values as-is', () => {
        expect(parseBool(true)).toBe(true);
        expect(parseBool(false)).toBe(false);
    });

    it('should parse truthy strings', () => {
        expect(parseBool('true')).toBe(true);
        expect(parseBool('1')).toBe(true);
        expect(parseBool('yes')).toBe(true);
        expect(parseBool('TRUE')).toBe(true);
        expect(parseBool(' Yes ')).toBe(true);
    });

    it('should parse falsy strings', () => {
        expect(parseBool('false')).toBe(false);
        expect(parseBool('0')).toBe(false);
        expect(parseBool('no')).toBe(false);
    });

    it('should return undefined for non-string, non-boolean types', () => {
        expect(parseBool(123)).toBeUndefined();
        expect(parseBool(null)).toBeUndefined();
        expect(parseBool({})).toBeUndefined();
    });

    it('should return undefined for unrecognized strings', () => {
        expect(parseBool('maybe')).toBeUndefined();
        expect(parseBool('2')).toBeUndefined();
    });
});

// ======================== parseNumber, parseInteger ========================
describe('parseNumber', () => {
    it('should parse valid numbers', () => {
        expect(parseNumber('42', 0)).toBe(42);
        expect(parseNumber('3.14', 0)).toBeCloseTo(3.14);
    });

    it('should return fallback for empty/null/undefined', () => {
        expect(parseNumber(undefined, 10)).toBe(10);
        expect(parseNumber(null, 5)).toBe(5);
        expect(parseNumber('', 7)).toBe(7);
    });

    it('should return fallback for non-finite values', () => {
        expect(parseNumber('abc', 99)).toBe(99);
        expect(parseNumber('Infinity', 0)).toBe(0); // Infinity is NOT finite, so fallback is returned
    });
});

describe('parseInteger', () => {
    it('should parse integers', () => {
        expect(parseInteger('42', 0)).toBe(42);
    });

    it('should return fallback for non-integer values', () => {
        expect(parseInteger('3.14', 0)).toBe(0);
        expect(parseInteger('abc', 5)).toBe(5);
    });
});

// ======================== toNumber ========================
describe('toNumber', () => {
    it('should convert values to numbers', () => {
        expect(toNumber('42')).toBe(42);
        expect(toNumber(null)).toBeNull();
        expect(toNumber(undefined)).toBeNull();
    });
});

// ======================== Date utilities ========================
describe('toDateOnly', () => {
    it('should format date as YYYY-MM-DD', () => {
        const date = new Date('2024-06-15T12:30:00Z');
        expect(toDateOnly(date)).toBe('2024-06-15');
    });
});

describe('startOfUtcDay', () => {
    it('should return start of UTC day', () => {
        const date = new Date('2024-06-15T14:30:00Z');
        const start = startOfUtcDay(date);
        expect(start.getUTCHours()).toBe(0);
        expect(start.getUTCMinutes()).toBe(0);
        expect(start.getUTCSeconds()).toBe(0);
    });
});

describe('endOfUtcDay', () => {
    it('should return end of UTC day', () => {
        const date = new Date('2024-06-15T14:30:00Z');
        const end = endOfUtcDay(date);
        expect(end.getUTCHours()).toBe(23);
        expect(end.getUTCMinutes()).toBe(59);
        expect(end.getUTCSeconds()).toBe(59);
    });
});

describe('addDaysUtc', () => {
    it('should add positive days', () => {
        const date = new Date('2024-06-15T00:00:00Z');
        const result = addDaysUtc(date, 5);
        expect(result.getUTCDate()).toBe(20);
    });

    it('should add negative days (subtract)', () => {
        const date = new Date('2024-06-15T00:00:00Z');
        const result = addDaysUtc(date, -5);
        expect(result.getUTCDate()).toBe(10);
    });
});

// ======================== getPeriodRange ========================
describe('getPeriodRange', () => {
    it('should return range for "today"', () => {
        const { start, end } = getPeriodRange({ period: 'today' });
        expect(start.getUTCHours()).toBe(0);
        expect(end.getUTCHours()).toBe(23);
    });

    it('should return range for "7d"', () => {
        const { start, end } = getPeriodRange({ period: '7d' });
        const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
        expect(diffDays).toBeGreaterThanOrEqual(6);
    });

    it('should return range for "30d"', () => {
        const { start, end } = getPeriodRange({ period: '30d' });
        const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
        expect(diffDays).toBeGreaterThanOrEqual(29);
    });

    it('should return range for "90d"', () => {
        const { start, end } = getPeriodRange({ period: '90d' });
        const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
        expect(diffDays).toBeGreaterThanOrEqual(89);
    });

    it('should throw for invalid period', () => {
        expect(() => getPeriodRange({ period: 'invalid' })).toThrow('Invalid period');
    });

    it('should parse custom startDate and endDate', () => {
        const { start, end } = getPeriodRange({ startDate: '2024-01-01', endDate: '2024-01-31' });
        expect(start.toISOString()).toBe('2024-01-01T00:00:00.000Z');
        expect(end.toISOString()).toBe('2024-01-31T23:59:59.999Z');
    });

    it('should throw for invalid custom dates', () => {
        expect(() => getPeriodRange({ startDate: 'not-a-date' })).toThrow('Invalid startDate or endDate');
    });
});

// ======================== Pagination ========================
describe('parsePagination', () => {
    it('should parse valid skip and take', () => {
        const result = parsePagination({ skip: '10', take: '20' });
        expect(result).toEqual({ skip: 10, take: 20 });
    });

    it('should use defaults for missing values', () => {
        const result = parsePagination({});
        expect(result).toEqual({ skip: 0, take: 20 });
    });

    it('should clamp take to maxTake', () => {
        const result = parsePagination({ take: '200' }, 20, 100);
        expect(result.take).toBe(100);
    });

    it('should enforce minimum skip of 0', () => {
        const result = parsePagination({ skip: '-5' });
        expect(result.skip).toBe(0);
    });
});

describe('buildPagination', () => {
    it('should build pagination metadata', () => {
        const result = buildPagination(100, 0, 20);
        expect(result).toEqual({ total: 100, skip: 0, take: 20, pages: 5 });
    });

    it('should return pages=0 for total=0', () => {
        const result = buildPagination(0, 0, 20);
        expect(result.pages).toBe(0);
    });

    it('should round up pages', () => {
        const result = buildPagination(21, 0, 20);
        expect(result.pages).toBe(2);
    });
});

// ======================== buildOrderStatusTimeline ========================
describe('buildOrderStatusTimeline', () => {
    const baseOrder = {
        createdAt: new Date('2024-01-01T10:00:00Z'),
        status: 'PENDING',
        paymentStatus: 'PENDING',
        payments: [],
    };

    it('should return PENDING only for a new order', () => {
        const timeline = buildOrderStatusTimeline(baseOrder, null);
        expect(timeline).toHaveLength(1);
        expect(timeline[0].status).toBe('PENDING');
    });

    it('should include PAID when there is a successful payment', () => {
        const order = {
            ...baseOrder,
            status: 'PAID',
            payments: [{ status: 'SUCCESS', paidAt: new Date('2024-01-01T11:00:00Z'), createdAt: new Date('2024-01-01T11:00:00Z') }],
        };
        const timeline = buildOrderStatusTimeline(order, null);
        const statuses = timeline.map((t) => t.status);
        expect(statuses).toContain('PAID');
    });

    it('should include SHIPPED when shipment is shipped', () => {
        const order = {
            ...baseOrder,
            status: 'SHIPPED',
            paymentStatus: 'SUCCESS',
            payments: [{ status: 'SUCCESS', paidAt: new Date('2024-01-01T11:00:00Z'), createdAt: new Date('2024-01-01T11:00:00Z') }],
        };
        const shipment = { status: 'SHIPPED', shippedAt: new Date('2024-01-02T10:00:00Z'), createdAt: new Date('2024-01-02T10:00:00Z') };
        const timeline = buildOrderStatusTimeline(order, shipment);
        const statuses = timeline.map((t) => t.status);
        expect(statuses).toContain('SHIPPED');
    });

    it('should include DELIVERED for delivered orders', () => {
        const order = {
            ...baseOrder,
            status: 'DELIVERED',
            payments: [{ status: 'SUCCESS', paidAt: new Date('2024-01-01T11:00:00Z'), createdAt: new Date('2024-01-01T11:00:00Z') }],
        };
        const timeline = buildOrderStatusTimeline(order, null);
        const statuses = timeline.map((t) => t.status);
        expect(statuses).toContain('DELIVERED');
    });

    it('should include CANCELLED for cancelled orders', () => {
        const order = { ...baseOrder, status: 'CANCELLED' };
        const timeline = buildOrderStatusTimeline(order, null);
        const statuses = timeline.map((t) => t.status);
        expect(statuses).toContain('CANCELLED');
    });
});

// ======================== parseTagsInput ========================
describe('parseTagsInput', () => {
    it('should return undefined for undefined input', () => {
        expect(parseTagsInput(undefined)).toBeUndefined();
    });

    it('should filter and trim array input', () => {
        expect(parseTagsInput(['tag1', ' tag2 ', '', null])).toEqual(['tag1', 'tag2']);
    });

    it('should parse CSV string', () => {
        expect(parseTagsInput('tag1, tag2, tag3')).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should parse JSON array string', () => {
        expect(parseTagsInput('["tag1","tag2"]')).toEqual(['tag1', 'tag2']);
    });

    it('should return empty array for empty string', () => {
        expect(parseTagsInput('')).toEqual([]);
    });

    it('should return empty array for non-string, non-array input', () => {
        expect(parseTagsInput(123)).toEqual([]);
    });
});

// ======================== parseVariantsInput ========================
describe('parseVariantsInput', () => {
    it('should return empty array for falsy input', () => {
        expect(parseVariantsInput(null)).toEqual([]);
        expect(parseVariantsInput(undefined)).toEqual([]);
        expect(parseVariantsInput('')).toEqual([]);
    });

    it('should return array as-is', () => {
        const arr = [{ size: '42' }];
        expect(parseVariantsInput(arr)).toEqual(arr);
    });

    it('should parse JSON string array', () => {
        const result = parseVariantsInput('[{"size":"42"}]');
        expect(result).toEqual([{ size: '42' }]);
    });

    it('should throw for non-array JSON string', () => {
        expect(() => parseVariantsInput('{"size":"42"}')).toThrow('variants must be a JSON array');
    });

    it('should throw for non-string, non-array input', () => {
        expect(() => parseVariantsInput(123)).toThrow('variants must be a JSON array');
    });
});

// ======================== getCookieOptions ========================
describe('getCookieOptions', () => {
    it('should return correct options for non-production', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const opts = getCookieOptions();
        expect(opts.httpOnly).toBe(true);
        expect(opts.secure).toBe(false);
        expect(opts.sameSite).toBe('lax');
        process.env.NODE_ENV = originalEnv;
    });

    it('should return correct options for production', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const opts = getCookieOptions();
        expect(opts.secure).toBe(true);
        expect(opts.sameSite).toBe('none');
        process.env.NODE_ENV = originalEnv;
    });
});
