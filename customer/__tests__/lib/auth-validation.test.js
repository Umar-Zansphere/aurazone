/**
 * Tests for src/lib/auth-validation.js
 * Functions: normalizePhone, isValidPhone, normalizeEmail, isValidEmail, getPasswordStrengthErrors
 */
import {
    normalizePhone,
    isValidPhone,
    normalizeEmail,
    isValidEmail,
    getPasswordStrengthErrors,
} from '@/lib/auth-validation';

// ─── normalizePhone ─────────────────────────────────────────────────────────

describe('normalizePhone', () => {
    test('returns empty string for empty input', () => {
        expect(normalizePhone('')).toBe('');
    });

    test('returns empty string for undefined', () => {
        expect(normalizePhone()).toBe('');
    });

    test('returns digits only for plain number', () => {
        expect(normalizePhone('1234567890')).toBe('1234567890');
    });

    test('preserves + prefix when present', () => {
        expect(normalizePhone('+1234567890')).toBe('+1234567890');
    });

    test('strips non-digit characters except leading +', () => {
        expect(normalizePhone('+1 (234) 567-890')).toBe('+1234567890');
    });

    test('strips non-digit characters from non-plus input', () => {
        expect(normalizePhone('(123) 456-7890')).toBe('1234567890');
    });

    test('trims whitespace', () => {
        expect(normalizePhone('  1234567890  ')).toBe('1234567890');
    });

    test('limits to 15 digits', () => {
        expect(normalizePhone('1234567890123456789')).toBe('123456789012345');
    });

    test('limits to 15 digits with + prefix', () => {
        expect(normalizePhone('+1234567890123456789')).toBe('+123456789012345');
    });

    test('returns empty for string with only non-digits', () => {
        expect(normalizePhone('abc')).toBe('');
    });
});

// ─── isValidPhone ───────────────────────────────────────────────────────────

describe('isValidPhone', () => {
    test('accepts valid 10-digit phone', () => {
        expect(isValidPhone('1234567890')).toBe(true);
    });

    test('accepts valid 15-digit phone', () => {
        expect(isValidPhone('123456789012345')).toBe(true);
    });

    test('accepts valid 12-digit phone (middle range)', () => {
        expect(isValidPhone('123456789012')).toBe(true);
    });

    test('accepts phone with + prefix', () => {
        expect(isValidPhone('+1234567890')).toBe(true);
    });

    test('rejects 9-digit phone (too short)', () => {
        expect(isValidPhone('123456789')).toBe(false);
    });

    test('rejects empty string', () => {
        expect(isValidPhone('')).toBe(false);
    });

    test('rejects undefined', () => {
        expect(isValidPhone()).toBe(false);
    });

    test('accepts formatted phone with enough digits', () => {
        expect(isValidPhone('+1 (234) 567-8901')).toBe(true);
    });
});

// ─── normalizeEmail ─────────────────────────────────────────────────────────

describe('normalizeEmail', () => {
    test('trims whitespace', () => {
        expect(normalizeEmail('  hello@test.com  ')).toBe('hello@test.com');
    });

    test('converts to lowercase', () => {
        expect(normalizeEmail('Hello@Test.COM')).toBe('hello@test.com');
    });

    test('trims and lowercases combined', () => {
        expect(normalizeEmail('  HELLO@Test.com  ')).toBe('hello@test.com');
    });

    test('returns empty for no argument', () => {
        expect(normalizeEmail()).toBe('');
    });

    test('returns empty for empty string', () => {
        expect(normalizeEmail('')).toBe('');
    });
});

// ─── isValidEmail ───────────────────────────────────────────────────────────

describe('isValidEmail', () => {
    test('accepts valid email', () => {
        expect(isValidEmail('hello@test.com')).toBe(true);
    });

    test('accepts email with subdomain', () => {
        expect(isValidEmail('user@mail.test.com')).toBe(true);
    });

    test('accepts uppercase email (normalizes)', () => {
        expect(isValidEmail('Hello@Test.COM')).toBe(true);
    });

    test('rejects email without @', () => {
        expect(isValidEmail('hellotest.com')).toBe(false);
    });

    test('rejects email without domain', () => {
        expect(isValidEmail('hello@')).toBe(false);
    });

    test('rejects email without TLD', () => {
        expect(isValidEmail('hello@test')).toBe(false);
    });

    test('rejects empty string', () => {
        expect(isValidEmail('')).toBe(false);
    });

    test('rejects undefined', () => {
        expect(isValidEmail()).toBe(false);
    });

    test('rejects email with spaces', () => {
        expect(isValidEmail('hello @test.com')).toBe(false);
    });
});

// ─── getPasswordStrengthErrors ──────────────────────────────────────────────

describe('getPasswordStrengthErrors', () => {
    test('returns empty array for strong password', () => {
        expect(getPasswordStrengthErrors('Abcd1234!')).toEqual([]);
    });

    test('returns error for too-short password', () => {
        const errors = getPasswordStrengthErrors('Ab1!');
        expect(errors).toContain('Password must be at least 8 characters long.');
    });

    test('returns error for missing lowercase', () => {
        const errors = getPasswordStrengthErrors('ABCD1234!');
        expect(errors).toContain('Password must include at least one lowercase letter.');
    });

    test('returns error for missing uppercase', () => {
        const errors = getPasswordStrengthErrors('abcd1234!');
        expect(errors).toContain('Password must include at least one uppercase letter.');
    });

    test('returns error for missing digit', () => {
        const errors = getPasswordStrengthErrors('Abcdefgh!');
        expect(errors).toContain('Password must include at least one number.');
    });

    test('returns error for missing special character', () => {
        const errors = getPasswordStrengthErrors('Abcdefg1');
        expect(errors).toContain('Password must include at least one special character.');
    });

    test('returns multiple errors for empty password', () => {
        const errors = getPasswordStrengthErrors('');
        expect(errors.length).toBeGreaterThan(1);
        expect(errors).toContain('Password must be at least 8 characters long.');
    });

    test('returns all errors for completely weak password', () => {
        const errors = getPasswordStrengthErrors('');
        // Empty has: too short, no lowercase, no uppercase, no digit, no special
        expect(errors).toHaveLength(5);
    });

    test('handles undefined input', () => {
        const errors = getPasswordStrengthErrors();
        expect(errors).toHaveLength(5);
    });

    test('complex password with all requirements passes', () => {
        expect(getPasswordStrengthErrors('MyP@ss1234')).toEqual([]);
    });
});
