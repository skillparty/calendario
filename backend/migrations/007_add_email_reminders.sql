-- Migración para sistema de recordatorios por email
-- Ejecutar en Supabase SQL Editor

BEGIN;

-- Agregar columna para trackear si se envió el recordatorio
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;

-- Agregar columna para timestamp de cuándo se envió
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Agregar columna para trackear si el usuario quiere recordatorio por email
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS email_reminder BOOLEAN DEFAULT TRUE;

-- Índice para búsqueda eficiente de tareas que necesitan recordatorio
CREATE INDEX IF NOT EXISTS idx_tasks_reminder_pending 
    ON tasks(date, time, reminder_sent) 
    WHERE reminder_sent = FALSE AND email_reminder = TRUE AND date IS NOT NULL;

-- Agregar email a users si no existe
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

COMMIT;

-- NOTA: Después de ejecutar esta migración:
-- 1. Las tareas existentes tendrán reminder_sent = FALSE
-- 2. Las nuevas tareas tendrán email_reminder = TRUE por defecto
-- 3. Solo se enviarán recordatorios para tareas con fecha, hora y email_reminder = TRUE
