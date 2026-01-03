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
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description || tokenData.error });
    }

    const accessToken = tokenData.access_token;

    // Get GitHub user
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const githubUser = await userResponse.json();

    // Find or create user in Supabase
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

// Get tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('date', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create task
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, date, time, priority, user_id } = req.body;
    
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ title, description, date, time, priority, user_id }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

module.exports = app;
