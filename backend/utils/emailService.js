const { Resend } = require('resend');
const logger = require('./logger.js');

class EmailService {
  constructor() {
    this.resend = null;
    this.initialized = false;
    this.fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev'; // Default Resend test email
  }

  /**
   * Initialize Resend client
   */
  init() {
    if (this.initialized) return;
    
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      logger.warn('RESEND_API_KEY not configured - email reminders disabled');
      return;
    }

    try {
      this.resend = new Resend(apiKey);
      this.initialized = true;
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  /**
   * Check if email service is available
   */
  isAvailable() {
    return this.initialized && this.resend !== null;
  }

  /**
   * Send task reminder email
   * @param {Object} options
   * @param {string} options.to - Recipient email
   * @param {string} options.userName - User's name
   * @param {string} options.taskTitle - Task title
   * @param {string} options.taskDescription - Task description
   * @param {string} options.taskDate - Task date (YYYY-MM-DD)
   * @param {string} options.taskTime - Task time (HH:mm)
   * @returns {Promise<Object>}
   */
  async sendTaskReminder({ to, userName, taskTitle, taskDescription, taskDate, taskTime }) {
    if (!this.isAvailable()) {
      throw new Error('Email service not available');
    }

    try {
      // Format date and time for display
      const dateObj = new Date(`${taskDate}T${taskTime}`);
      const formattedDate = dateObj.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const formattedTime = dateObj.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .task-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .time-badge { display: inline-block; background: #667eea; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Recordatorio de Tarea</h1>
            </div>
            <div class="content">
              <p>Hola ${userName || 'Usuario'},</p>
              <p>Este es un recordatorio de que tienes una tarea programada en <strong>60 minutos</strong>:</p>
              
              <div class="task-card">
                <h2 style="margin-top: 0; color: #667eea;">📋 ${taskTitle}</h2>
                ${taskDescription ? `<p style="color: #666;">${taskDescription}</p>` : ''}
                <div style="margin-top: 20px;">
                  <span class="time-badge">📅 ${formattedDate}</span>
                  <span class="time-badge" style="margin-left: 10px;">🕐 ${formattedTime}</span>
                </div>
              </div>
              
              <p style="margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL || 'https://calendario-frontend-ashy.vercel.app'}" 
                   style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Ver en Calendario
                </a>
              </p>
              
              <div class="footer">
                <p>Has recibido este email porque activaste los recordatorios en tu Calendario Digital.</p>
                <p>Para desactivar los recordatorios, edita la tarea en tu calendario.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: [to],
        subject: `⏰ Recordatorio: ${taskTitle} en 60 minutos`,
        html: html,
        text: `Recordatorio de tarea:\n\n${taskTitle}\n${taskDescription || ''}\n\nFecha: ${formattedDate}\nHora: ${formattedTime}\n\nEste recordatorio se envía 60 minutos antes de la hora programada.`
      });

      logger.info(`Reminder email sent to ${to} for task "${taskTitle}"`);
      return result;
    } catch (error) {
      logger.error('Failed to send reminder email:', error);
      throw error;
    }
  }

  /**
   * Send test email (for verification)
   */
  async sendTestEmail(to) {
    if (!this.isAvailable()) {
      throw new Error('Email service not available');
    }

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: [to],
        subject: 'Test - Calendario Digital',
        html: '<h1>✅ Email service is working!</h1><p>Your Calendario app is ready to send reminders.</p>'
      });

      logger.info(`Test email sent to ${to}`);
      return result;
    } catch (error) {
      logger.error('Failed to send test email:', error);
      throw error;
    }
  }
}

// Singleton instance
const emailService = new EmailService();

module.exports = { emailService };
