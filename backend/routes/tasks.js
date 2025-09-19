const express = require('express');
const { body, query: queryValidator, validationResult } = require('express-validator');
const { query } = require('../utils/db.js');
const { authenticate, authorize } = require('../middleware/auth.js');
const { asyncHandler, AppError } = require('../middleware/errorHandler.js');
const logger = require('../utils/logger.js');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation rules
const taskValidation = [
  body('title').trim().isLength({ min: 1, max: 500 }).withMessage('Title must be between 1 and 500 characters'),
  body('description').optional().isLength({ max: 2000 }).withMessage('Description must be less than 2000 characters'),
  body('date').optional().isISO8601().withMessage('Date must be in ISO format (YYYY-MM-DD)'),
  body('time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format'),
  body('completed').optional().isBoolean().withMessage('Completed must be a boolean'),
  body('is_reminder').optional().isBoolean().withMessage('Is_reminder must be a boolean'),
  body('priority').optional().isInt({ min: 1, max: 5 }).withMessage('Priority must be between 1 and 5'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
];

const updateTaskValidation = [
  body('title').optional().trim().isLength({ min: 1, max: 500 }).withMessage('Title must be between 1 and 500 characters'),
  body('description').optional().isLength({ max: 2000 }).withMessage('Description must be less than 2000 characters'),
  body('date').optional().isISO8601().withMessage('Date must be in ISO format (YYYY-MM-DD)'),
  body('time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format'),
  body('completed').optional().isBoolean().withMessage('Completed must be a boolean'),
  body('is_reminder').optional().isBoolean().withMessage('Is_reminder must be a boolean'),
  body('priority').optional().isInt({ min: 1, max: 5 }).withMessage('Priority must be between 1 and 5'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
];

const queryValidation = [
  queryValidator('date').optional().isISO8601().withMessage('Date must be in ISO format'),
  queryValidator('start_date').optional().isISO8601().withMessage('Start date must be in ISO format'),
  queryValidator('end_date').optional().isISO8601().withMessage('End date must be in ISO format'),
  queryValidator('completed').optional().isBoolean().withMessage('Completed must be a boolean'),
  queryValidator('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  queryValidator('year').optional().isInt({ min: 2000, max: 3000 }).withMessage('Year must be between 2000 and 3000'),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  queryValidator('offset').optional().isInt({ min: 0 }).withMessage('Offset must be 0 or greater')
];

// Handle validation errors
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log validation errors for debugging
    logger.error('Validation errors:', errors.array());
    logger.error('Request body:', req.body);
    throw new AppError('Validation failed', 400, errors.array());
  }
  next();
}

// GET /api/tasks
// Get tasks for the authenticated user with optional filtering
router.get('/', queryValidation, handleValidationErrors, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    date,
    start_date,
    end_date,
    completed,
    month,
    year,
    limit = 50,
    offset = 0
  } = req.query;

  let queryText = `
    SELECT id, title, description, date, time, completed, is_reminder, priority, tags, created_at, updated_at
    FROM tasks 
    WHERE user_id = $1
  `;
  
  const queryParams = [userId];
  let paramIndex = 2;

  // Build dynamic WHERE conditions
  if (date) {
    queryText += ` AND date = $${paramIndex}`;
    queryParams.push(date);
    paramIndex++;
  }

  if (start_date && end_date) {
    queryText += ` AND date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
    queryParams.push(start_date, end_date);
    paramIndex += 2;
  } else if (start_date) {
    queryText += ` AND date >= $${paramIndex}`;
    queryParams.push(start_date);
    paramIndex++;
  } else if (end_date) {
    queryText += ` AND date <= $${paramIndex}`;
    queryParams.push(end_date);
    paramIndex++;
  }

  if (completed !== undefined) {
    queryText += ` AND completed = $${paramIndex}`;
    queryParams.push(completed === 'true');
    paramIndex++;
  }

  if (month && year) {
    queryText += ` AND EXTRACT(MONTH FROM date) = $${paramIndex} AND EXTRACT(YEAR FROM date) = $${paramIndex + 1}`;
    queryParams.push(month, year);
    paramIndex += 2;
  } else if (month) {
    queryText += ` AND EXTRACT(MONTH FROM date) = $${paramIndex}`;
    queryParams.push(month);
    paramIndex++;
  } else if (year) {
    queryText += ` AND EXTRACT(YEAR FROM date) = $${paramIndex}`;
    queryParams.push(year);
    paramIndex++;
  }

  // Add ordering and pagination
  queryText += ` ORDER BY date ASC, created_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  queryParams.push(limit, offset);

  const result = await query(queryText, queryParams);

  // Get total count for pagination
  let countQuery = `SELECT COUNT(*) FROM tasks WHERE user_id = $1`;
  const countParams = [userId];
  
  // Apply same filters to count query (simplified version)
  if (date) {
    countQuery += ` AND date = $2`;
    countParams.push(date);
  } else if (start_date && end_date) {
    countQuery += ` AND date BETWEEN $2 AND $3`;
    countParams.push(start_date, end_date);
  } else if (month && year) {
    countQuery += ` AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3`;
    countParams.push(month, year);
  }
  
  if (completed !== undefined) {
    const nextParam = countParams.length + 1;
    countQuery += ` AND completed = $${nextParam}`;
    countParams.push(completed === 'true');
  }

  const countResult = await query(countQuery, countParams);
  const totalCount = parseInt(countResult.rows[0].count);

  res.json({
    success: true,
    data: result.rows,
    pagination: {
      total: totalCount,
      limit: parseInt(limit),
      offset: parseInt(offset),
      has_more: totalCount > parseInt(offset) + parseInt(limit)
    }
  });
}));

// GET /api/tasks/:id
// Get a specific task by ID
router.get('/:id', authorize(), asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;

  const result = await query(
    'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
    [taskId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Task not found', 404);
  }

  res.json({
    success: true,
    data: result.rows[0]
  });
}));

// POST /api/tasks
// Create a new task
router.post('/', taskValidation, handleValidationErrors, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    title,
    description = null,
    date = null,
    time = null,
    completed = false,
    is_reminder = true,
    priority = 1,
    tags = []
  } = req.body;

  const result = await query(
    `INSERT INTO tasks (user_id, title, description, date, time, completed, is_reminder, priority, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [userId, title, description, date, time, completed, is_reminder, priority, tags]
  );

  logger.info(`User ${userId} created task ${result.rows[0].id}`);

  res.status(201).json({
    success: true,
    data: result.rows[0]
  });
}));

// PUT /api/tasks/:id
// Update a task
router.put('/:id', updateTaskValidation, handleValidationErrors, authorize(), asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;

  // First check if task exists and belongs to user
  const existingTask = await query(
    'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
    [taskId, userId]
  );

  if (existingTask.rows.length === 0) {
    throw new AppError('Task not found', 404);
  }

  // Build dynamic update query
  const updates = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = ['title', 'description', 'date', 'time', 'completed', 'is_reminder', 'priority', 'tags'];
  
  for (const field of allowedFields) {
    if (req.body.hasOwnProperty(field)) {
      updates.push(`${field} = $${paramIndex}`);
      values.push(req.body[field]);
      paramIndex++;
    }
  }

  if (updates.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  // Add WHERE clause parameters
  values.push(taskId, userId);
  
  const updateQuery = `
    UPDATE tasks 
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
    RETURNING *
  `;

  const result = await query(updateQuery, values);

  logger.info(`User ${userId} updated task ${taskId}`);

  res.json({
    success: true,
    data: result.rows[0]
  });
}));

// DELETE /api/tasks/:id
// Delete a task
router.delete('/:id', authorize(), asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;

  const result = await query(
    'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
    [taskId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Task not found', 404);
  }

  logger.info(`User ${userId} deleted task ${taskId}`);

  res.json({
    success: true,
    message: 'Task deleted successfully'
  });
}));

// PATCH /api/tasks/:id/toggle
// Toggle task completion status
router.patch('/:id/toggle', authorize(), asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;

  const result = await query(
    `UPDATE tasks 
     SET completed = NOT completed, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2 
     RETURNING *`,
    [taskId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Task not found', 404);
  }

  logger.info(`User ${userId} toggled task ${taskId} completion`);

  res.json({
    success: true,
    data: result.rows[0]
  });
}));

// GET /api/tasks/stats
// Get task statistics for the user
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { year = new Date().getFullYear(), month } = req.query;

  let dateFilter = 'WHERE user_id = $1';
  const params = [userId];
  let paramIndex = 2;

  if (year) {
    dateFilter += ` AND EXTRACT(YEAR FROM date) = $${paramIndex}`;
    params.push(year);
    paramIndex++;
  }

  if (month) {
    dateFilter += ` AND EXTRACT(MONTH FROM date) = $${paramIndex}`;
    params.push(month);
  }

  const statsQuery = `
    SELECT 
      COUNT(*) as total_tasks,
      COUNT(*) FILTER (WHERE completed = true) as completed_tasks,
      COUNT(*) FILTER (WHERE completed = false) as pending_tasks,
      COUNT(*) FILTER (WHERE date = CURRENT_DATE) as today_tasks,
      COUNT(*) FILTER (WHERE date = CURRENT_DATE AND completed = false) as today_pending
    FROM tasks 
    ${dateFilter}
  `;

  const result = await query(statsQuery, params);

  res.json({
    success: true,
    data: result.rows[0]
  });
}));

module.exports = router;