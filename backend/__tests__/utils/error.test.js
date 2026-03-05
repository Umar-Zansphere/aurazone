/**
 * Unit tests for utils/error.js
 * Tests CustomError class and createError factory function
 */
const { CustomError, createError } = require('../../utils/error');

describe('CustomError', () => {
    it('should set statusCode and message', () => {
        const error = new CustomError(404, 'Not found');
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Not found');
    });

    it('should set status to "fail" for 4xx errors', () => {
        const error = new CustomError(400, 'Bad request');
        expect(error.status).toBe('fail');
    });

    it('should set status to "error" for 5xx errors', () => {
        const error = new CustomError(500, 'Server error');
        expect(error.status).toBe('error');
    });

    it('should be an instance of Error', () => {
        const error = new CustomError(400, 'Test');
        expect(error).toBeInstanceOf(Error);
    });

    it('should capture stack trace', () => {
        const error = new CustomError(400, 'Test');
        expect(error.stack).toBeDefined();
        expect(error.stack).toContain('error.test.js');
    });

    it('should set status to "fail" for 4xx boundary (400)', () => {
        expect(new CustomError(400, 'x').status).toBe('fail');
    });

    it('should set status to "fail" for 4xx boundary (499)', () => {
        expect(new CustomError(499, 'x').status).toBe('fail');
    });

    it('should set status to "error" for 500', () => {
        expect(new CustomError(500, 'x').status).toBe('error');
    });
});

describe('createError', () => {
    it('should return a CustomError instance', () => {
        const error = createError(404, 'Not found');
        expect(error).toBeInstanceOf(CustomError);
        expect(error).toBeInstanceOf(Error);
    });

    it('should pass statusCode and message correctly', () => {
        const error = createError(409, 'Conflict');
        expect(error.statusCode).toBe(409);
        expect(error.message).toBe('Conflict');
    });
});
