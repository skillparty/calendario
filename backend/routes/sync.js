const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../utils/db.js');
const { githubAPI } = require('../utils/github.js');
const { authenticate } = require('../middleware/auth.js');
const { asyncHandler, AppError } = require('../middleware/errorHandler.js');
const logger = require('../utils/logger.js');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Handle validation errors
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400, errors.array());
  }
  next();
}

// POST /api/sync/backup
// Backup user tasks to GitHub Gist
router.post('/backup', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get user's access token
  const userResult = await query(
    'SELECT access_token, gist_id FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const { access_token: accessToken, gist_id: gistId } = userResult.rows[0];

  if (!accessToken) {
    throw new AppError('GitHub access token not available', 400);
  }

  // Get all user tasks
  const tasksResult = await query(
    `SELECT id, title, description, date, completed, is_reminder, priority, tags, created_at, updated_at
     FROM tasks 
     WHERE user_id = $1 
     ORDER BY date ASC`,
    [userId]
  );

  // Format tasks data for Gist (compatible with frontend format)
  const tasksData = {};
  tasksResult.rows.forEach(task => {
    const dateKey = task.date.toISOString().split('T')[0];
    if (!tasksData[dateKey]) {
      tasksData[dateKey] = [];
    }
    
    tasksData[dateKey].push({
      id: task.id.toString(),
      title: task.title,
      description: task.description || '',
      date: dateKey,
      completed: task.completed,
      isReminder: task.is_reminder,
      priority: task.priority || 1,
      tags: task.tags || [],
      created_at: task.created_at,
      updated_at: task.updated_at
    });
  });

  try {
    let gist;
    const filename = 'calendar-tasks.json';

    if (gistId) {
      // Update existing gist
      gist = await githubAPI.updateGist(accessToken, gistId, filename, tasksData);
    } else {
      // Create new gist
      gist = await githubAPI.createGist(accessToken, filename, tasksData);
      
      // Save gist ID to user record
      await query(
        'UPDATE users SET gist_id = $1 WHERE id = $2',
        [gist.id, userId]
      );
    }

    logger.info(`User ${userId} backed up ${tasksResult.rows.length} tasks to gist ${gist.id}`);

    res.json({
      success: true,
      message: 'Tasks backed up successfully',
      gist_id: gist.id,
      tasks_count: tasksResult.rows.length,
      backup_url: gist.html_url
    });

  } catch (error) {
    logger.error(`Backup failed for user ${userId}:`, error);
    throw new AppError('Failed to backup tasks to GitHub Gist', 500);
  }
}));

// POST /api/sync/restore
// Restore tasks from GitHub Gist
router.post('/restore', [
  body('merge_strategy').optional().isIn(['replace', 'merge']).withMessage('Merge strategy must be "replace" or "merge"')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { merge_strategy = 'merge' } = req.body;

  // Get user's access token and gist ID
  const userResult = await query(
    'SELECT access_token, gist_id FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const { access_token: accessToken, gist_id: gistId } = userResult.rows[0];

  if (!accessToken) {
    throw new AppError('GitHub access token not available', 400);
  }

  if (!gistId) {
    throw new AppError('No backup gist found for this user', 404);
  }

  try {
    // Get gist data
    const gist = await githubAPI.getGist(accessToken, gistId);
    const tasksFile = gist.files['calendar-tasks.json'];

    if (!tasksFile || !tasksFile.content) {
      throw new AppError('No tasks data found in backup', 404);
    }

    const gistData = JSON.parse(tasksFile.content);
    
    // Begin transaction for data consistency
    const client = await query('BEGIN');
    
    try {
      if (merge_strategy === 'replace') {
        // Delete all existing tasks
        await query('DELETE FROM tasks WHERE user_id = $1', [userId]);
      }

      let restoredCount = 0;
      let skippedCount = 0;

      // Process each date's tasks
      for (const [dateKey, taskList] of Object.entries(gistData)) {
        for (const task of taskList) {
          if (merge_strategy === 'merge') {
            // Check if task already exists
            const existingTask = await query(
              'SELECT id FROM tasks WHERE user_id = $1 AND title = $2 AND date = $3',
              [userId, task.title, dateKey]
            );

            if (existingTask.rows.length > 0) {
              skippedCount++;
              continue;
            }
          }

          // Insert task
          await query(
            `INSERT INTO tasks (user_id, title, description, date, completed, is_reminder, priority, tags)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              userId,
              task.title,
              task.description || null,
              dateKey,
              task.completed || false,
              task.isReminder !== undefined ? task.isReminder : true,
              task.priority || 1,
              task.tags || []
            ]
          );

          restoredCount++;
        }
      }

      await query('COMMIT');

      logger.info(`User ${userId} restored ${restoredCount} tasks from gist ${gistId}`);

      res.json({
        success: true,
        message: 'Tasks restored successfully',
        restored_count: restoredCount,
        skipped_count: skippedCount,
        strategy: merge_strategy
      });

    } catch (dbError) {
      await query('ROLLBACK');
      throw dbError;
    }

  } catch (error) {
    logger.error(`Restore failed for user ${userId}:`, error);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Failed to restore tasks from GitHub Gist', 500);
  }
}));

// GET /api/sync/status
// Get sync status and information
router.get('/status', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get user info
  const userResult = await query(
    'SELECT gist_id, updated_at FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const { gist_id: gistId, updated_at: userUpdatedAt } = userResult.rows[0];

  // Get task statistics
  const statsResult = await query(
    `SELECT 
       COUNT(*) as total_tasks,
       MAX(updated_at) as last_task_update
     FROM tasks 
     WHERE user_id = $1`,
    [userId]
  );

  const stats = statsResult.rows[0];

  let gistInfo = null;
  if (gistId) {
    try {
      const userAccessToken = await query(
        'SELECT access_token FROM users WHERE id = $1',
        [userId]
      );

      if (userAccessToken.rows[0]?.access_token) {
        const gist = await githubAPI.getGist(userAccessToken.rows[0].access_token, gistId);
        gistInfo = {
          id: gist.id,
          url: gist.html_url,
          updated_at: gist.updated_at,
          files: Object.keys(gist.files)
        };
      }
    } catch (error) {
      logger.warn(`Failed to get gist info for user ${userId}:`, error);
    }
  }

  res.json({
    success: true,
    data: {
      has_backup: !!gistId,
      gist_info: gistInfo,
      total_tasks: parseInt(stats.total_tasks),
      last_task_update: stats.last_task_update,
      user_updated_at: userUpdatedAt
    }
  });
}));

// DELETE /api/sync/backup
// Delete backup gist
router.delete('/backup', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get user's gist ID
  const userResult = await query(
    'SELECT gist_id FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const { gist_id: gistId } = userResult.rows[0];

  if (!gistId) {
    throw new AppError('No backup found to delete', 404);
  }

  // Remove gist ID from user record
  await query(
    'UPDATE users SET gist_id = NULL WHERE id = $1',
    [userId]
  );

  logger.info(`User ${userId} removed backup gist reference ${gistId}`);

  res.json({
    success: true,
    message: 'Backup reference removed successfully'
  });
}));

module.exports = router;