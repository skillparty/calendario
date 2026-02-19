// Vercel Serverless Function Entry Point
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// CORS - permitir todas las origenes para simplificar
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// Supabase client
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// JWT helper
const jwt = require('jsonwebtoken');
function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
}

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();
    
    if (error || !user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Calendario Backend API',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth/github',
      tasks: '/api/tasks',
      health: '/api/health'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', database: 'Supabase' });
});

// GitHub OAuth
app.post('/api/auth/github', async (req, res) => {
  try {
    console.log('[AUTH] Starting GitHub OAuth flow');
    const { code, redirect_uri } = req.body;
    
    if (!code) {
      console.log('[AUTH] No code provided');
      return res.status(400).json({ error: 'Code is required' });
    }

    // Clean environment variables (remove whitespace/newlines)
    const clientId = (process.env.GITHUB_CLIENT_ID || '').trim();
    const clientSecret = (process.env.GITHUB_CLIENT_SECRET || '').trim();

    console.log('[AUTH] Code received:', code.substring(0, 10) + '...');
    console.log('[AUTH] Redirect URI:', redirect_uri);
    console.log('[AUTH] Client ID:', clientId);
    console.log('[AUTH] Client Secret exists:', !!clientSecret);
    console.log('[AUTH] Exchanging code for token...');
    
    const requestBody = {
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirect_uri
    };
    console.log('[AUTH] Request to GitHub:', JSON.stringify(requestBody, null, 2));
    
    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const tokenData = await tokenResponse.json();
    console.log('[AUTH] Token response:', tokenData);
    
    if (tokenData.error) {
      console.log('[AUTH] Token error:', tokenData.error);
      return res.status(400).json({ error: tokenData.error_description || tokenData.error });
    }

    const accessToken = tokenData.access_token;
    console.log('[AUTH] Got access token, fetching user...');

    // Get GitHub user
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const githubUser = await userResponse.json();
    console.log('[AUTH] GitHub user:', githubUser.login);

    // Find or create user in Supabase
    console.log('[AUTH] Finding user in database...');
    let { data: users } = await supabase
      .from('users')
      .select('*')
      .eq('github_id', String(githubUser.id))
      .limit(1);

    let user;

    if (users && users.length > 0) {
      // Update existing user
      const { data } = await supabase
        .from('users')
        .update({
          username: githubUser.login,
          email: githubUser.email,
          avatar_url: githubUser.avatar_url
        })
        .eq('id', users[0].id)
        .select()
        .single();
      user = data;
    } else {
      // Create new user
      const { data } = await supabase
        .from('users')
        .insert([{
          github_id: String(githubUser.id),
          username: githubUser.login,
          email: githubUser.email,
          avatar_url: githubUser.avatar_url
        }])
        .select()
        .single();
      user = data;
    }

    // Generate JWT
    const jwtToken = generateToken({
      userId: user.id,
      githubId: user.github_id,
      username: user.username
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        github_id: user.github_id
      },
      token: jwtToken,
      jwt: jwtToken, // mantener ambos por compatibilidad
      github_access_token: accessToken
    });

  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed', message: error.message });
  }
});

// Get current user info
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        avatar_url: req.user.avatar_url,
        github_id: req.user.github_id
      }
    });
  } catch (error) {
    console.error('Auth/me error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Get tasks - REQUIRES AUTHENTICATION
app.get('/api/tasks', authenticate, async (req, res) => {
  try {
    const { group_id, limit: qLimit, offset: qOffset } = req.query;
    
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', req.user.id);
    
    if (group_id !== undefined) {
      if (group_id === 'null' || group_id === '') {
        query = query.is('group_id', null);
      } else {
        query = query.eq('group_id', parseInt(group_id));
      }
    }

    const limit = parseInt(qLimit, 10);
    const offset = parseInt(qOffset, 10);
    if (Number.isFinite(limit) && Number.isFinite(offset) && limit > 0 && offset >= 0) {
      query = query.range(offset, offset + limit - 1);
    }
    
    query = query.order('date', { ascending: true, nullsFirst: false });
    
    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data: data || [], count: (data || []).length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create task - REQUIRES AUTHENTICATION
app.post('/api/tasks', authenticate, async (req, res) => {
  try {
    const { title, description, date, time, priority, completed, group_id, is_reminder, tags } = req.body;
    
    const taskData = { 
      title, 
      description: description || null, 
      date: date || null, 
      time: time || null, 
      priority: priority || 'media',
      user_id: req.user.id,
      group_id: group_id || null,
      is_reminder: is_reminder !== undefined ? is_reminder : true,
      tags: tags || [],
      completed: completed !== undefined ? Boolean(completed) : false
    };
    
    const { data, error } = await supabase
      .from('tasks')
      .insert([taskData])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task - REQUIRES AUTHENTICATION
app.put('/api/tasks/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    delete updates.id;
    delete updates.user_id;
    delete updates.created_at;
    
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Task not found or not authorized' });
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete task - REQUIRES AUTHENTICATION
app.delete('/api/tasks/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

module.exports = app;
