-- Migración para permitir fechas NULL en tareas
-- Ejecutar esto en Supabase SQL Editor

BEGIN;

-- Permitir que date sea NULL para tareas sin fecha asignada
ALTER TABLE tasks ALTER COLUMN date DROP NOT NULL;

-- Agregar índice para tareas sin fecha (date IS NULL)
CREATE INDEX IF NOT EXISTS idx_tasks_no_date ON tasks(user_id) WHERE date IS NULL;

COMMIT;

-- NOTA: Después de ejecutar esta migración en Supabase,
-- las tareas podrán crearse sin fecha asignada
