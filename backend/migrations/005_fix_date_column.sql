-- Fix date column to allow NULL values for undated tasks
-- Migration: 005_fix_date_column.sql

-- Remove NOT NULL constraint from date column to allow undated tasks
ALTER TABLE tasks ALTER COLUMN date DROP NOT NULL;

-- Add comment to document the change
COMMENT ON COLUMN tasks.date IS 'Optional date for the task in YYYY-MM-DD format. NULL for undated tasks';
