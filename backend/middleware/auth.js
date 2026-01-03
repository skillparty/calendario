const jwt = require('jsonwebtoken');
const { query } = require('../utils/db.js');
const logger = require('../utils/logger.js');
const { AppError } = require('./errorHandler.js');

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'calendario-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Generate JWT token
function generateToken(userId, githubId) {
  return jwt.sign(
    { 
      userId, 
      githubId,
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new AppError('Invalid or expired token', 401);
  }
}

// Authentication middleware
async function authenticate(req, res, next) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access token required', 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyToken(token);

    // Get user from database
    const result = await query(
      'SELECT id, github_id, username, name, email, avatar_url FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 401);
    }

    // Add user to request object
    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    logger.error('Authentication error:', error);
    next(new AppError('Authentication failed', 401));
  }
}

// Optional authentication (for public endpoints that can benefit from user context)
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      
      const result = await query(
        'SELECT id, github_id, username, name, email, avatar_url FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length > 0) {
        req.user = result.rows[0];
      }
    }
    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
}

// Check if user owns resource
function authorize(resourceUserIdField = 'user_id') {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      // For route parameters like :id
      if (req.params.id && resourceUserIdField === 'user_id') {
        const resourceId = req.params.id;
        
        // Check if the resource belongs to the authenticated user
        // This will be implemented per resource type
        const tableName = req.route.path.includes('tasks') ? 'tasks' : 'users';
        
        if (tableName === 'tasks') {
          const result = await query(
            'SELECT user_id FROM tasks WHERE id = $1',
            [resourceId]
          );
          
          if (result.rows.length === 0) {
            throw new AppError('Resource not found', 404);
          }
          
          if (result.rows[0].user_id !== req.user.id) {
            throw new AppError('Access denied', 403);
          }
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { generateToken, verifyToken, authenticate, optionalAuth, authorize };