const jwt = require('jsonwebtoken');
const { supabase } = require('../utils/supabase.js');
const logger = require('../utils/logger.js');
const { AppError } = require('./errorHandler.js');

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'calendario-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Generate JWT token
function generateToken(payload) {
  // Support both object and positional arguments for backward compatibility
  if (typeof payload !== 'object') {
    // Old style: generateToken(userId, githubId)
    payload = { 
      userId: arguments[0], 
      githubId: arguments[1]
    };
  }
  
  return jwt.sign(
    { 
      userId: payload.userId,
      githubId: payload.githubId,
      username: payload.username,
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

    // Get user from Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('id, github_id, username, name, email, avatar_url')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      throw new AppError('User not found', 401);
    }

    // Add user to request object
    req.user = user;
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
      
      const { data: user, error } = await supabase
        .from('users')
        .select('id, github_id, username, name, email, avatar_url')
        .eq('id', decoded.userId)
        .single();

      if (!error && user) {
        req.user = user;
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
          const { data: resource, error } = await supabase
            .from('tasks')
            .select('user_id')
            .eq('id', resourceId)
            .single();
          
          if (error || !resource) {
            throw new AppError('Resource not found', 404);
          }
          
          if (resource.user_id !== req.user.id) {
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