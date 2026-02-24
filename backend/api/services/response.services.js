/**
 * Unified response formatting service for consistent API responses
 * and toast notifications across the application
 */

/**
 * Create a success response
 * @param {string} message - Success message
 * @param {*} data - Response data
 * @param {string} toastMessage - Optional custom toast message (defaults to message)
 * @returns {Object} Formatted success response
 */
const successResponse = (message, data = null, toastMessage = null) => {
    return {
        success: true,
        message,
        data,
        toast: {
            type: 'success',
            message: toastMessage || message,
        },
    };
};

/**
 * Create an error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} toastMessage - Optional custom toast message (defaults to message)
 * @returns {Object} Formatted error response
 */
const errorResponse = (message, statusCode = 500, toastMessage = null) => {
    return {
        success: false,
        message,
        statusCode,
        toast: {
            type: 'error',
            message: toastMessage || message,
        },
    };
};

/**
 * Create a validation error response
 * @param {Array|Object} errors - Validation errors
 * @returns {Object} Formatted validation error response
 */
const validationError = (errors) => {
    const errorMessage = Array.isArray(errors)
        ? errors.join(', ')
        : typeof errors === 'object'
            ? Object.values(errors).join(', ')
            : errors;

    return {
        success: false,
        message: 'Validation failed',
        errors,
        statusCode: 400,
        toast: {
            type: 'error',
            message: errorMessage,
        },
    };
};

/**
 * Create an info response
 * @param {string} message - Info message
 * @param {*} data - Response data
 * @returns {Object} Formatted info response
 */
const infoResponse = (message, data = null) => {
    return {
        success: true,
        message,
        data,
        toast: {
            type: 'info',
            message,
        },
    };
};

/**
 * Create a warning response
 * @param {string} message - Warning message
 * @param {*} data - Response data
 * @returns {Object} Formatted warning response
 */
const warningResponse = (message, data = null) => {
    return {
        success: true,
        message,
        data,
        toast: {
            type: 'warning',
            message,
        },
    };
};

module.exports = {
    successResponse,
    errorResponse,
    validationError,
    infoResponse,
    warningResponse,
};
