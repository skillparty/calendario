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
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRES_IN = '7d';

function generateToken(payload) {
  // Support both object and legacy (userId, githubId) parameters
  if (typeof payload !== 'object') {
    payload = {
      userId: arguments[0],
      githubId: arguments[1],
      username: arguments[2]
    };
  }
  return jwt.sign({
    userId: payload.userId,
    githubId: payload.githubId,
    username: payload.username
  }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Middleware de autenticación JWT
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from Supabase
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
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Calendario Backend API - Supabase Edition',
    version: '2.1.0',
    endpoints: {
      auth: '/api/auth/github',
      tasks: '/api/tasks',
      groups: '/api/groups',
      cron: '/api/cron',
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

// ============================================
// GROUPS ENDPOINTS
// ============================================

// Get user groups
app.get('/api/groups', authenticate, asyncHandler(async (req, res) => {
  const { data: groups, error } = await supabase
    .from('groups')
    .select(`
      *,
      group_members!inner(role)
    `)
    .eq('group_members.user_id', req.user.id);

  if (error) throw error;
  res.json({ success: true, data: groups || [] });
}));

// Create group
app.post('/api/groups', authenticate, asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Create group
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert([{ name, description, created_by: req.user.id }])
    .select()
    .single();

  if (groupError) throw groupError;

  // Add creator as admin
  const { error: memberError } = await supabase
    .from('group_members')
    .insert([{ group_id: group.id, user_id: req.user.id, role: 'admin' }]);

  if (memberError) throw memberError;

  res.status(201).json({ success: true, data: group });
}));

// Get group members
app.get('/api/groups/:id/members', authenticate, asyncHandler(async (req, res) => {
  const { data: members, error } = await supabase
    .from('group_members')
    .select(`
      *,
      users(id, username, avatar_url, email)
    `)
    .eq('group_id', req.params.id);

  if (error) throw error;
  res.json({ success: true, data: members || [] });
}));

// Invite to group
app.post('/api/groups/:id/invite', authenticate, asyncHandler(async (req, res) => {
  const { github_username } = req.body;

  if (!github_username) {
    return res.status(400).json({ error: 'github_username is required' });
  }

  // Check if user is admin
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (!membership || membership.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can invite members' });
  }

  // Find invited user
  const { data: invitedUser } = await supabase
    .from('users')
    .select('id')
    .eq('username', github_username)
    .single();

  // Create invitation
  const { data: invitation, error } = await supabase
    .from('group_invitations')
    .insert([{
      group_id: req.params.id,
      invited_by: req.user.id,
      invited_user: invitedUser?.id || null,
      github_username: github_username,
      status: 'pending'
    }])
    .select()
    .single();

  if (error) throw error;
  res.status(201).json({ success: true, data: invitation });
}));

// Get pending invitations
app.get('/api/groups/invitations/pending', authenticate, asyncHandler(async (req, res) => {
  const { data: invitations, error } = await supabase
    .from('group_invitations')
    .select(`
      *,
      groups(id, name, description),
      invited_by_user:users!group_invitations_invited_by_fkey(username, avatar_url)
    `)
    .eq('invited_user', req.user.id)
    .eq('status', 'pending');

  if (error) throw error;
  res.json({ success: true, data: invitations || [] });
}));

// Accept/Reject invitation
app.patch('/api/groups/invitations/:id', authenticate, asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  // Get invitation
  const { data: invitation, error: invError } = await supabase
    .from('group_invitations')
    .select('*')
    .eq('id', req.params.id)
    .eq('invited_user', req.user.id)
    .single();

  if (invError || !invitation) {
    return res.status(404).json({ error: 'Invitation not found' });
  }

  // Update invitation
  const { error: updateError } = await supabase
    .from('group_invitations')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', req.params.id);

  if (updateError) throw updateError;

  // If accepted, add user to group
  if (status === 'accepted') {
    const { error: memberError } = await supabase
      .from('group_members')
      .insert([{
        group_id: invitation.group_id,
        user_id: req.user.id,
        role: 'member'
      }]);

    if (memberError) throw memberError;
  }

  res.json({ success: true, data: { status } });
}));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

module.exports = app;
