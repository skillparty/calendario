const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { errorHandler } = require('./middleware/errorHandler.js');
const taskRoutes = require('./routes/tasks-supabase.js');
const authRoutes = require('./routes/auth-supabase.js');
const cronRoutes = require('./routes/cron.js');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for proper IP forwarding
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Method override for sendBeacon (always sends POST, but we need PUT for task updates)
app.use((req, res, next) => {
  if (req.query._method && req.method === 'POST') {
    req.method = String(req.query._method).toUpperCase();
  }
  // Support Bearer token in query param for sendBeacon (can't set custom headers)
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration - SIMPLIFICADO para permitir todas las origenes
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Root endpoint  
app.get('/', (req, res) => {
  res.json({
    message: 'Calendario Backend API - Supabase Edition',
    version: '2.1.0',
    documentation: '/api/health',
    endpoints: {
      auth: '/api/auth/github',
      tasks: '/api/tasks',
      cron: '/api/cron'
    }
  });
});

// Legacy health check (keep for backward compatibility)
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    database: 'Supabase'
  });
});

// API routes
console.log('[SERVER] Mounting auth routes...');
app.use('/api/auth', authRoutes);
console.log('[SERVER] Mounting task routes...');
app.use('/api/tasks', taskRoutes);
console.log('[SERVER] Mounting cron routes...');
app.use('/api/cron', cronRoutes);
console.log('[SERVER] All routes mounted');

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling
app.use(errorHandler);

// Export for Vercel serverless
module.exports = app;

// Start server only if not in serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Calendar10 Backend - Supabase Edition`);
    console.log(`📡 Server running on 0.0.0.0:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`☁️  Database: Supabase`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔗 API Base: http://localhost:${PORT}/api`);
  });
}