class CustomError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

const createError = (statusCode, message) => {
  return new CustomError(statusCode, message);
};

module.exports = {
  CustomError,
  createError
};