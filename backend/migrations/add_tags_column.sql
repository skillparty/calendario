-- Agregar columna tags a la tabla tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Agregar índice GIN para búsquedas eficientes en arrays (opcional pero recomendado)
-- CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN(tags);
