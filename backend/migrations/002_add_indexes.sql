-- Performance indexes for common queries
-- Optimizes database performance for typical calendar operations

BEGIN;

-- Index for user lookups by GitHub ID (login)
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);

-- Index for user tasks by date (most common query)
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);

-- Index for user tasks by completion status
CREATE INDEX IF NOT EXISTS idx_tasks_user_completed ON tasks(user_id, completed);

-- Index for date range queries (month view, etc.)
CREATE INDEX IF NOT EXISTS idx_tasks_date_range ON tasks(date);

-- Index for priority-based queries
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(user_id, priority);

-- Composite index for dashboard queries (user tasks with date and completion)
CREATE INDEX IF NOT EXISTS idx_tasks_dashboard ON tasks(user_id, date, completed);

-- Index for text search on titles (using GIN for better text search)
CREATE INDEX IF NOT EXISTS idx_tasks_title_search ON tasks USING gin(to_tsvector('english', title));

-- Index for tasks updated recently (sync operations)
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(user_id, updated_at);

COMMIT;