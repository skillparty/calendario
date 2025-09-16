-- Add time column to tasks table
-- Migration: 004_add_time_column.sql

ALTER TABLE tasks ADD COLUMN time TIME;

-- Add index on time column for better query performance
CREATE INDEX idx_tasks_time ON tasks(time);

-- Add comment to document the column
COMMENT ON COLUMN tasks.time IS 'Optional time for the task in HH:MM format';
