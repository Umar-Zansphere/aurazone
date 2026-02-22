/**
 * Higher-order function to wrap async route handlers and catch errors
 * Passes caught errors to the global error handling middleware
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = catchAsync;
