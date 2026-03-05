/**
 * Unit tests for utils/catchAsync.js
 * Tests the async error-catching wrapper for Express routes
 */
const catchAsync = require('../../utils/catchAsync');

describe('catchAsync', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        mockReq = {};
        mockRes = { json: jest.fn(), status: jest.fn().mockReturnThis() };
        mockNext = jest.fn();
    });

    it('should call the wrapped function with req, res, next', async () => {
        const fn = jest.fn().mockResolvedValue(undefined);
        const wrapped = catchAsync(fn);
        await wrapped(mockReq, mockRes, mockNext);
        expect(fn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });

    it('should not call next on successful execution', async () => {
        const fn = jest.fn().mockResolvedValue(undefined);
        const wrapped = catchAsync(fn);
        await wrapped(mockReq, mockRes, mockNext);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next with error when async function throws', async () => {
        const error = new Error('Test error');
        const fn = jest.fn().mockRejectedValue(error);
        const wrapped = catchAsync(fn);
        await wrapped(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledWith(error);
    });




    it('should handle functions that return rejected promises', async () => {
        const error = new Error('Rejected promise');
        const fn = jest.fn().mockImplementation(() => Promise.reject(error));
        const wrapped = catchAsync(fn);
        await wrapped(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should return a function', () => {
        const fn = jest.fn();
        const wrapped = catchAsync(fn);
        expect(typeof wrapped).toBe('function');
    });
});
