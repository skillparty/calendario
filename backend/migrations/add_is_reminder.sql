-- Agregar columna is_reminder a la tabla tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_reminder BOOLEAN DEFAULT TRUE;

-- Actualizar índice si es necesario (opcional)
-- CREATE INDEX IF NOT EXISTS idx_tasks_is_reminder ON tasks(is_reminder);
