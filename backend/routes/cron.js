const express = require('express');
const { supabase } = require('../utils/supabase.js');
const { emailService } = require('../utils/emailService.js');
const { asyncHandler, AppError } = require('../middleware/errorHandler.js');
const logger = require('../utils/logger.js');

const router = express.Router();

// Initialize email service
emailService.init();

/**
 * GET /api/cron/check-reminders
 * Vercel Cron Job endpoint - Se ejecuta cada minuto
 * Verifica tareas que necesitan recordatorio en los próximos 60-61 minutos
 */
router.get('/check-reminders', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  // Verificar que la request viene de Vercel Cron
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn('Unauthorized cron job attempt');
    throw new AppError('Unauthorized', 401);
  }

  logger.info('🔔 Cron job started: checking for reminders...');

  if (!emailService.isAvailable()) {
    logger.warn('Email service not available, skipping reminder check');
    return res.json({
      success: true,
      message: 'Email service not configured',
      processed: 0
    });
  }

  try {
    // Calcular el rango de tiempo: ahora + 60 minutos hasta ahora + 61 minutos
    const now = new Date();
    const reminderStart = new Date(now.getTime() + 60 * 60 * 1000); // +60 min
    const reminderEnd = new Date(now.getTime() + 61 * 60 * 1000);   // +61 min

    // Formatear para Supabase (YYYY-MM-DD y HH:MM:SS)
    const dateStr = reminderStart.toISOString().split('T')[0];
    const timeStartStr = reminderStart.toTimeString().slice(0, 5); // HH:MM
    const timeEndStr = reminderEnd.toTimeString().slice(0, 5);     // HH:MM

    logger.info(`Checking tasks for ${dateStr} between ${timeStartStr} and ${timeEndStr}`);

    // Buscar tareas que necesitan recordatorio
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        date,
        time,
        user_id,
        users (
          email,
          username,
          name
        )
      `)
      .eq('date', dateStr)
      .gte('time', timeStartStr)
      .lt('time', timeEndStr)
      .eq('email_reminder', true)
      .eq('reminder_sent', false)
      .not('time', 'is', null)
      .not('users.email', 'is', null);

    if (error) {
      logger.error('Error fetching tasks for reminders:', error);
      throw new AppError('Database error', 500);
    }

    logger.info(`Found ${tasks?.length || 0} tasks needing reminders`);

    let sent = 0;
    let failed = 0;

    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        try {
          const user = task.users;
          
          if (!user || !user.email) {
            logger.warn(`Skipping task ${task.id}: no user email`);
            continue;
          }

          // Enviar email de recordatorio
          await emailService.sendTaskReminder({
            to: user.email,
            userName: user.name || user.username,
            taskTitle: task.title,
            taskDescription: task.description,
            taskDate: task.date,
            taskTime: task.time
          });

          // Marcar como enviado
          const { error: updateError } = await supabase
            .from('tasks')
            .update({
              reminder_sent: true,
              reminder_sent_at: new Date().toISOString()
            })
            .eq('id', task.id);

          if (updateError) {
            logger.error(`Error updating task ${task.id}:`, updateError);
            failed++;
          } else {
            sent++;
            logger.info(`✅ Reminder sent for task ${task.id}: "${task.title}" to ${user.email}`);
          }

        } catch (emailError) {
          logger.error(`Failed to send reminder for task ${task.id}:`, emailError);
          failed++;
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`🔔 Cron job completed in ${duration}ms: ${sent} sent, ${failed} failed`);

    res.json({
      success: true,
      checked: tasks?.length || 0,
      sent: sent,
      failed: failed,
      duration: `${duration}ms`
    });

  } catch (error) {
    logger.error('Cron job error:', error);
    throw error;
  }
}));

/**
 * POST /api/cron/test-email
 * Endpoint para probar el envío de emails (solo para desarrollo)
 */
router.post('/test-email', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  if (!emailService.isAvailable()) {
    throw new AppError('Email service not configured', 503);
  }

  try {
    const result = await emailService.sendTestEmail(email);
    
    res.json({
      success: true,
      message: 'Test email sent successfully',
      result: result
    });
  } catch (error) {
    logger.error('Test email failed:', error);
    throw new AppError('Failed to send test email', 500);
  }
}));

module.exports = router;
