-- Performance optimizations for Calendar10 database
-- Adds indexes, partitioning, and materialized views for better performance

BEGIN;

-- ============================================
-- INDEXES FOR COMMON QUERIES
-- ============================================

-- Composite index for user's tasks by date
CREATE INDEX IF NOT EXISTS idx_tasks_user_date_time 
ON tasks(user_id, date, time) 
WHERE date IS NOT NULL;

-- Index for pending tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user_pending 
ON tasks(user_id, completed) 
WHERE completed = false;

-- Index for reminder tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user_reminders 
ON tasks(user_id, date, time) 
WHERE is_reminder = true AND completed = false;

-- Index for task search (if using full-text search)
CREATE INDEX IF NOT EXISTS idx_tasks_search 
ON tasks USING gin(to_tsvector('spanish', title || ' ' || COALESCE(description, '')));

-- Index for tags array
CREATE INDEX IF NOT EXISTS idx_tasks_tags 
ON tasks USING gin(tags);

-- Index for updated_at for sync operations
CREATE INDEX IF NOT EXISTS idx_tasks_updated 
ON tasks(user_id, updated_at DESC);

-- ============================================
-- MATERIALIZED VIEW FOR USER STATISTICS
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS user_task_stats AS
SELECT 
    user_id,
    DATE_TRUNC('month', date) as month,
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE completed = true) as completed_tasks,
    COUNT(*) FILTER (WHERE completed = false) as pending_tasks,
    COUNT(*) FILTER (WHERE is_reminder = true) as reminder_tasks,
    COUNT(*) FILTER (WHERE date IS NULL) as undated_tasks,
    AVG(CASE WHEN completed = true 
        THEN EXTRACT(EPOCH FROM (updated_at - created_at))/3600 
        ELSE NULL END) as avg_completion_hours
FROM tasks
GROUP BY user_id, DATE_TRUNC('month', date)
WITH DATA;

-- Index for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_task_stats_unique 
ON user_task_stats(user_id, month);

-- ============================================
-- FUNCTION FOR REFRESHING STATS
-- ============================================

CREATE OR REPLACE FUNCTION refresh_user_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_task_stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PARTITIONING FOR LARGE DATASETS (OPTIONAL)
-- ============================================

-- Create parent table for partitioned tasks (for future use)
CREATE TABLE IF NOT EXISTS tasks_partitioned (
    LIKE tasks INCLUDING ALL
) PARTITION BY RANGE (date);

-- Create partitions for current and next year
DO $$
DECLARE
    current_year INT := EXTRACT(YEAR FROM CURRENT_DATE);
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    FOR year_offset IN 0..1 LOOP
        partition_name := 'tasks_' || (current_year + year_offset);
        start_date := DATE ((current_year + year_offset) || '-01-01');
        end_date := DATE ((current_year + year_offset + 1) || '-01-01');
        
        -- Check if partition exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_class 
            WHERE relname = partition_name
        ) THEN
            EXECUTE format('
                CREATE TABLE %I PARTITION OF tasks_partitioned
                FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date
            );
        END IF;
    END LOOP;
END $$;

-- ============================================
-- FUNCTION FOR AUTOMATIC PARTITION CREATION
-- ============================================

CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    -- Create partition for next month
    partition_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    partition_name := 'tasks_' || TO_CHAR(partition_date, 'YYYY_MM');
    start_date := partition_date;
    end_date := partition_date + INTERVAL '1 month';
    
    -- Check if partition exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = partition_name
    ) THEN
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF tasks_partitioned
            FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- OPTIMIZED SEARCH FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION search_tasks(
    p_user_id INTEGER,
    p_query TEXT,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id INTEGER,
    title VARCHAR(500),
    description TEXT,
    date DATE,
    time TIME,
    completed BOOLEAN,
    is_reminder BOOLEAN,
    priority INTEGER,
    tags TEXT[],
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.title,
        t.description,
        t.date,
        t.time,
        t.completed,
        t.is_reminder,
        t.priority,
        t.tags,
        ts_rank(
            to_tsvector('spanish', t.title || ' ' || COALESCE(t.description, '')),
            plainto_tsquery('spanish', p_query)
        ) as rank
    FROM tasks t
    WHERE 
        t.user_id = p_user_id
        AND to_tsvector('spanish', t.title || ' ' || COALESCE(t.description, '')) 
            @@ plainto_tsquery('spanish', p_query)
    ORDER BY rank DESC, t.date DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION FOR BULK OPERATIONS
-- ============================================

CREATE OR REPLACE FUNCTION bulk_update_tasks(
    p_user_id INTEGER,
    p_task_ids INTEGER[],
    p_updates JSONB
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE tasks
    SET 
        title = COALESCE((p_updates->>'title')::VARCHAR(500), title),
        description = COALESCE(p_updates->>'description', description),
        date = COALESCE((p_updates->>'date')::DATE, date),
        time = COALESCE((p_updates->>'time')::TIME, time),
        completed = COALESCE((p_updates->>'completed')::BOOLEAN, completed),
        is_reminder = COALESCE((p_updates->>'is_reminder')::BOOLEAN, is_reminder),
        priority = COALESCE((p_updates->>'priority')::INTEGER, priority),
        tags = COALESCE(
            ARRAY(SELECT jsonb_array_elements_text(p_updates->'tags')),
            tags
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE 
        user_id = p_user_id 
        AND id = ANY(p_task_ids);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ANALYTICS FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_task_analytics(
    p_user_id INTEGER,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    metric_name TEXT,
    metric_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH task_metrics AS (
        SELECT 
            COUNT(*) as total_tasks,
            COUNT(*) FILTER (WHERE completed = true) as completed_tasks,
            COUNT(*) FILTER (WHERE completed = false) as pending_tasks,
            COUNT(*) FILTER (WHERE date < CURRENT_DATE AND completed = false) as overdue_tasks,
            COUNT(DISTINCT date) as active_days,
            AVG(CASE 
                WHEN completed = true 
                THEN EXTRACT(EPOCH FROM (updated_at - created_at))/3600 
                ELSE NULL 
            END) as avg_completion_hours
        FROM tasks
        WHERE 
            user_id = p_user_id
            AND date BETWEEN p_start_date AND p_end_date
    )
    SELECT 'total_tasks', total_tasks FROM task_metrics
    UNION ALL
    SELECT 'completed_tasks', completed_tasks FROM task_metrics
    UNION ALL
    SELECT 'pending_tasks', pending_tasks FROM task_metrics
    UNION ALL
    SELECT 'overdue_tasks', overdue_tasks FROM task_metrics
    UNION ALL
    SELECT 'active_days', active_days FROM task_metrics
    UNION ALL
    SELECT 'avg_completion_hours', ROUND(avg_completion_hours, 2) FROM task_metrics
    UNION ALL
    SELECT 'completion_rate', 
        CASE 
            WHEN total_tasks > 0 
            THEN ROUND((completed_tasks::NUMERIC / total_tasks) * 100, 2)
            ELSE 0
        END
    FROM task_metrics;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CLEANUP OLD DATA FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_completed_tasks(
    p_days_to_keep INTEGER DEFAULT 365
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM tasks
    WHERE 
        completed = true
        AND updated_at < CURRENT_TIMESTAMP - (p_days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PERFORMANCE MONITORING
-- ============================================

-- Create table for query performance logging
CREATE TABLE IF NOT EXISTS query_performance_log (
    id SERIAL PRIMARY KEY,
    query_hash TEXT,
    query_text TEXT,
    execution_time_ms NUMERIC,
    rows_returned INTEGER,
    user_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance analysis
CREATE INDEX IF NOT EXISTS idx_query_performance_time 
ON query_performance_log(created_at DESC, execution_time_ms DESC);

-- Function to log slow queries
CREATE OR REPLACE FUNCTION log_slow_query(
    p_query TEXT,
    p_execution_time_ms NUMERIC,
    p_rows_returned INTEGER,
    p_user_id INTEGER DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    -- Only log queries slower than 100ms
    IF p_execution_time_ms > 100 THEN
        INSERT INTO query_performance_log (
            query_hash,
            query_text,
            execution_time_ms,
            rows_returned,
            user_id
        ) VALUES (
            MD5(p_query),
            LEFT(p_query, 1000), -- Truncate long queries
            p_execution_time_ms,
            p_rows_returned,
            p_user_id
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant necessary permissions to the application user
-- Replace 'app_user' with your actual application database user
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO app_user;
        GRANT SELECT ON user_task_stats TO app_user;
        GRANT EXECUTE ON FUNCTION search_tasks TO app_user;
        GRANT EXECUTE ON FUNCTION bulk_update_tasks TO app_user;
        GRANT EXECUTE ON FUNCTION get_task_analytics TO app_user;
        GRANT EXECUTE ON FUNCTION refresh_user_stats TO app_user;
    END IF;
END $$;

COMMIT;
