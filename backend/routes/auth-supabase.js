const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../utils/supabase.js');
const { generateToken } = require('../middleware/auth.js');
const logger = require('../utils/logger.js');

const router = express.Router();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes working', timestamp: new Date().toISOString() });
});

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// Validation middleware
const validateAuth = [
  body('code').notEmpty().withMessage('Authorization code is required'),
];

// Handle validation errors
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
}

// Exchange GitHub code for access token
async function exchangeCodeForToken(code) {
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code: code
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    return data.access_token;
  } catch (error) {
    logger.error('Error exchanging GitHub code:', error);
    throw error;
  }
}

// Get GitHub user information
async function getGitHubUser(accessToken) {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('Error getting GitHub user:', error);
    throw error;
  }
}

// POST /api/auth/github
// Exchange GitHub authorization code for access token and user info
router.post('/github', async (req, res) => {
  try {
    console.log('[AUTH /github] Request received:', { body: req.body, hasCode: !!req.body.code });
    const { code } = req.body;
    
    if (!code) {
      console.log('[AUTH /github] No code provided');
      return res.status(400).json({ error: 'Code is required' });
    }

    console.log('[AUTH /github] Exchanging code for token...');
    // Step 1: Exchange code for access token
    const accessToken = await exchangeCodeForToken(code);
    
    if (!accessToken) {
      console.log('[AUTH /github] No access token received');
      return res.status(400).json({
        error: 'Failed to obtain access token from GitHub'
      });
    }

    console.log('[AUTH /github] Getting GitHub user...');
    // Step 2: Get user information from GitHub
    const githubUser = await getGitHubUser(accessToken);
    
    if (!githubUser) {
      console.log('[AUTH /github] No GitHub user received');
      return res.status(400).json({
        error: 'Failed to get user information from GitHub'
      });
    }

    // Step 3: Find or create user in Supabase
    const { data: existingUsers, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('github_id', String(githubUser.id))
      .limit(1);

    if (findError) {
      logger.error('Error finding user:', findError);
      return res.status(500).json({
        error: 'Database error',
        details: findError.message
      });
    }

    let user;

    if (existingUsers && existingUsers.length > 0) {
      // Update existing user
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          username: githubUser.login,
          email: githubUser.email,
          avatar_url: githubUser.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUsers[0].id)
        .select()
        .single();

      if (updateError) {
        logger.error('Error updating user:', updateError);
        return res.status(500).json({
          error: 'Failed to update user',
          details: updateError.message
        });
      }

      user = updatedUser;
    } else {
      // Create new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          github_id: String(githubUser.id),
          username: githubUser.login,
          email: githubUser.email,
          avatar_url: githubUser.avatar_url
        }])
        .select()
        .single();

      if (insertError) {
        logger.error('Error creating user:', insertError);
        return res.status(500).json({
          error: 'Failed to create user',
          details: insertError.message
        });
      }

      user = newUser;
    }

    // Step 4: Generate JWT token
    const jwt = generateToken({
      userId: user.id,
      githubId: user.github_id,
      username: user.username
    });

    // Step 5: Return user data and JWT
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        github_id: user.github_id
      },
      token: jwt,
      jwt: jwt,
      github_access_token: accessToken
    });

  } catch (error) {
    logger.error('GitHub auth error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
});

// GET /api/auth/status
// Check authentication status
router.get('/status', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      authenticated: false,
      message: 'No authentication token provided'
    });
  }

  // In a real implementation, verify the JWT token here
  res.json({
    authenticated: true,
    message: 'User is authenticated'
  });
});

module.exports = router;
