/**
 * Unit tests for api/services/response.services.js
 * Tests all response formatting functions
 */
const {
    successResponse,
    errorResponse,
    validationError,
    infoResponse,
    warningResponse,
} = require('../../api/services/response.services');

describe('successResponse', () => {
    it('should return success response with message and data', () => {
        const result = successResponse('Created', { id: 1 });
        expect(result.success).toBe(true);
        expect(result.message).toBe('Created');
        expect(result.data).toEqual({ id: 1 });
        expect(result.toast.type).toBe('success');
        expect(result.toast.message).toBe('Created');
    });

    it('should use custom toast message when provided', () => {
        const result = successResponse('Created', null, 'Item created!');
        expect(result.toast.message).toBe('Item created!');
    });

    it('should default data to null', () => {
        const result = successResponse('OK');
        expect(result.data).toBeNull();
    });
});

describe('errorResponse', () => {
    it('should return error response with message and statusCode', () => {
        const result = errorResponse('Not found', 404);
        expect(result.success).toBe(false);
        expect(result.message).toBe('Not found');
        expect(result.statusCode).toBe(404);
        expect(result.toast.type).toBe('error');
    });

    it('should default statusCode to 500', () => {
        const result = errorResponse('Server error');
        expect(result.statusCode).toBe(500);
    });

    it('should use custom toast message', () => {
        const result = errorResponse('Error', 500, 'Something went wrong');
        expect(result.toast.message).toBe('Something went wrong');
    });
});

describe('validationError', () => {
    it('should handle array of errors', () => {
        const result = validationError(['Field1 required', 'Field2 invalid']);
        expect(result.success).toBe(false);
        expect(result.message).toBe('Validation failed');
        expect(result.statusCode).toBe(400);
        expect(result.errors).toEqual(['Field1 required', 'Field2 invalid']);
        expect(result.toast.message).toBe('Field1 required, Field2 invalid');
    });

    it('should handle object of errors', () => {
        const result = validationError({ name: 'Name required', email: 'Email invalid' });
        expect(result.toast.message).toBe('Name required, Email invalid');
    });

    it('should handle string error', () => {
        const result = validationError('Invalid input');
        expect(result.toast.message).toBe('Invalid input');
    });
});

describe('infoResponse', () => {
    it('should return info response', () => {
        const result = infoResponse('Info message', { count: 5 });
        expect(result.success).toBe(true);
        expect(result.toast.type).toBe('info');
        expect(result.data).toEqual({ count: 5 });
    });

    it('should default data to null', () => {
        const result = infoResponse('Info');
        expect(result.data).toBeNull();
    });
});

describe('warningResponse', () => {
    it('should return warning response', () => {
        const result = warningResponse('Warning!', { threshold: 10 });
        expect(result.success).toBe(true);
        expect(result.toast.type).toBe('warning');
        expect(result.data).toEqual({ threshold: 10 });
    });

    it('should default data to null', () => {
        const result = warningResponse('Heads up');
        expect(result.data).toBeNull();
    });
});
