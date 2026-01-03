const express = require('express');
const { body, validationResult } = require('express-validator');
const { githubAPI } = require('../utils/github.js');
const { query } = require('../utils/db.js');
const { generateToken } = require('../middleware/auth.js');
const { asyncHandler, AppError } = require('../middleware/errorHandler.js');
const logger = require('../utils/logger.js');

const router = express.Router();

// Validation middleware
const validateAuth = [
  body('code').notEmpty().withMessage('Authorization code is required'),
  body('redirect_uri').isURL().withMessage('Valid redirect URI is required'),
];

// Handle validation errors
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400, errors.array());
  }
  next();
}

// POST /api/auth/github
// Exchange GitHub authorization code for access token and user info
router.post('/github', validateAuth, handleValidationErrors, asyncHandler(async (req, res) => {
  const { code, redirect_uri } = req.body;

  try {
    // Step 1: Exchange code for access token
    const accessToken = await githubAPI.exchangeCodeForToken(code, redirect_uri);
    
    if (!accessToken) {
      throw new AppError('Failed to obtain access token from GitHub', 400);
    }

    // Step 2: Get user information from GitHub
    const githubUser = await githubAPI.getUser(accessToken);
    
    if (!githubUser) {
      throw new AppError('Failed to get user information from GitHub', 400);
    }

    // Step 3: Find or create user in database
    let user = await findOrCreateUser(githubUser, accessToken);

    // Step 4: Find existing calendar gist
    try {
      const existingGist = await githubAPI.findCalendarGist(accessToken);
      if (existingGist && existingGist.id) {
        // Update user's gist_id if found
        await query(
          'UPDATE users SET gist_id = $1 WHERE id = $2',
          [existingGist.id, user.id]
        );
        user.gist_id = existingGist.id;
      }
    } catch (gistError) {
      // Log but don't fail the auth process
      logger.warn('Failed to find existing gist:', gistError);
    }

    // Step 5: Generate JWT token
    const token = generateToken(user.id, user.github_id);

    // Step 6: Return success response
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        github_id: user.github_id,
        username: user.username,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        gist_id: user.gist_id
      }
    });

  } catch (error) {
    logger.error('GitHub authentication failed:', error);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    // Handle specific GitHub API errors
    if (error.response && error.response.status === 401) {
      throw new AppError('Invalid authorization code', 401);
    }
    
    throw new AppError('Authentication failed', 500);
  }
}));

// POST /api/auth/refresh
// Refresh JWT token (if needed)
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;
  
  if (!refresh_token) {
    throw new AppError('Refresh token required', 400);
  }
  
  // For now, we'll just return an error since we're using simple JWT
  // In a production app, you might implement refresh tokens
  throw new AppError('Refresh tokens not implemented', 501);
}));

// GET /api/auth/me
// Get current user information
router.get('/me', require('../middleware/auth.js').authenticate, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      github_id: req.user.github_id,
      username: req.user.username,
      name: req.user.name,
      email: req.user.email,
      avatar_url: req.user.avatar_url
    }
  });
}));

// Helper function to find or create user
async function findOrCreateUser(githubUser, accessToken) {
  // Try to find existing user
  let result = await query(
    'SELECT * FROM users WHERE github_id = $1',
    [githubUser.id]
  );

  if (result.rows.length > 0) {
    // Update existing user with latest info
    const updateResult = await query(
      `UPDATE users SET 
        username = $1, 
        name = $2, 
        email = $3, 
        avatar_url = $4, 
        access_token = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE github_id = $6 
      RETURNING *`,
      [
        githubUser.login,
        githubUser.name,
        githubUser.email,
        githubUser.avatar_url,
        accessToken,
        githubUser.id
      ]
    );
    
    return updateResult.rows[0];
  } else {
    // Create new user
    const insertResult = await query(
      `INSERT INTO users (
        github_id, username, name, email, avatar_url, access_token
      ) VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`,
      [
        githubUser.id,
        githubUser.login,
        githubUser.name,
        githubUser.email,
        githubUser.avatar_url,
        accessToken
      ]
    );
    
    return insertResult.rows[0];
  }
}

module.exports = router;