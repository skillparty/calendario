const { logger } = require('../utils/logger.js');

function errorHandler(err, req, res, next) {
  logger.error('Error:', err);

  // Default error
  let error = {
    message: err.message || 'Internal Server Error',
    status: err.status || 500
  };

  // Validation errors
  if (err.name === 'ValidationError') {
    error.status = 400;
    error.message = 'Validation Error';
    error.details = err.details;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.status = 401;
    error.message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    error.status = 401;
    error.message = 'Token expired';
  }

  // Database errors
  if (err.code === '23505') { // Unique violation
    error.status = 409;
    error.message = 'Resource already exists';
  }

  if (err.code === '23503') { // Foreign key violation
    error.status = 400;
    error.message = 'Invalid reference';
  }

  // CORS errors
  if (err.message && err.message.includes('CORS')) {
    error.status = 403;
    error.message = 'CORS policy violation';
  }

  // Rate limit errors
  if (err.message && err.message.includes('Too many requests')) {
    error.status = 429;
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && error.status === 500) {
    error.message = 'Internal Server Error';
    delete error.details;
  }

  res.status(error.status).json({
    error: error.message,
    ...(error.details && { details: error.details }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

// Async error wrapper
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Create custom error
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.status = statusCode;
    this.details = details;
    this.name = 'AppError';
  }
}

module.exports = { errorHandler, asyncHandler, AppError };