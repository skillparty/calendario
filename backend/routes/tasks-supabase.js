const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../utils/supabase.js');
const { asyncHandler, AppError } = require('../middleware/errorHandler.js');
const logger = require('../utils/logger.js');

const router = express.Router();

// Middleware de autenticación simple (sin JWT por ahora)
const authenticate = (req, res, next) => {
  // Por ahora, crear un usuario de prueba
  // TODO: Implementar autenticación real con GitHub OAuth
  req.user = {
    id: '00000000-0000-0000-0000-000000000001', // UUID de prueba
    username: 'usuario_prueba'
  };
  next();
};

router.use(authenticate);

// Validación
const taskValidation = [
  body('title').trim().isLength({ min: 1, max: 500 }).withMessage('Title required'),
  body('date').isISO8601().withMessage('Valid date required'),
  body('time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid time format HH:MM'),
  body('description').optional().isLength({ max: 2000 }),
  body('completed').optional().isBoolean(),
  body('priority').optional().isIn(['baja', 'media', 'alta'])
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
}

// GET /api/tasks - Obtener todas las tareas del usuario
router.get('/', asyncHandler(async (req, res) => {
  const { date, start_date, end_date, completed, month, year } = req.query;
  
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', req.user.id)
    .order('date', { ascending: true });

  // Filtros opcionales
  if (date) query = query.eq('date', date);
  if (start_date && end_date) query = query.gte('date', start_date).lte('date', end_date);
  if (completed !== undefined) query = query.eq('completed', completed === 'true');
  
  const { data, error } = await query;

  if (error) {
    logger.error('Error fetching tasks:', error);
    throw new AppError('Error fetching tasks', 500);
  }

  res.json({
    success: true,
    data: data || [],
    count: data?.length || 0
  });
}));

// GET /api/tasks/:id - Obtener una tarea específica
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .eq('user_id', req.user.id)
    .single();

  if (error || !data) {
    throw new AppError('Task not found', 404);
  }

  res.json({
    success: true,
    data
  });
}));

// POST /api/tasks - Crear una nueva tarea
router.post('/', taskValidation, handleValidationErrors, asyncHandler(async (req, res) => {
  const { title, description, date, time, completed, priority } = req.body;

  const newTask = {
    user_id: req.user.id,
    title,
    description: description || null,
    date,
    time: time || null,
    completed: completed || false,
    priority: priority || 'media'
  };

  const { data, error } = await supabase
    .from('tasks')
    .insert([newTask])
    .select()
    .single();

  if (error) {
    logger.error('Error creating task:', error);
    throw new AppError('Error creating task', 500);
  }

  logger.info(`Task created: ${data.id} by user ${req.user.id}`);

  res.status(201).json({
    success: true,
    data
  });
}));

// PUT /api/tasks/:id - Actualizar una tarea
router.put('/:id', taskValidation, handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, date, time, completed, priority } = req.body;

  const updates = {
    title,
    description,
    date,
    time,
    completed,
    priority
  };

  // Remover campos undefined
  Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .eq('user_id', req.user.id)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('Task not found or update failed', 404);
  }

  logger.info(`Task updated: ${id} by user ${req.user.id}`);

  res.json({
    success: true,
    data
  });
}));

// PATCH /api/tasks/:id - Actualización parcial
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Remover campos que no deben actualizarse
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

  if (error || !data) {
    throw new AppError('Task not found or update failed', 404);
  }

  res.json({
    success: true,
    data
  });
}));

// DELETE /api/tasks/:id - Eliminar una tarea
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id);

  if (error) {
    throw new AppError('Task not found or delete failed', 404);
  }

  logger.info(`Task deleted: ${id} by user ${req.user.id}`);

  res.json({
    success: true,
    message: 'Task deleted successfully'
  });
}));

// POST /api/tasks/sync - Sincronizar tareas (bulk operations)
router.post('/sync', asyncHandler(async (req, res) => {
  const { tasks } = req.body;

  if (!Array.isArray(tasks)) {
    throw new AppError('Tasks must be an array', 400);
  }

  // Agregar user_id a todas las tareas
  const tasksWithUser = tasks.map(task => ({
    ...task,
    user_id: req.user.id
  }));

  const { data, error } = await supabase
    .from('tasks')
    .upsert(tasksWithUser, { onConflict: 'id' })
    .select();

  if (error) {
    logger.error('Error syncing tasks:', error);
    throw new AppError('Error syncing tasks', 500);
  }

  res.json({
    success: true,
    data,
    count: data?.length || 0
  });
}));

module.exports = router;
