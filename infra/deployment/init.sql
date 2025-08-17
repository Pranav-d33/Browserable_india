-- Initialize Bharat Agents database

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'todo',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP WITH TIME ZONE,
    assigned_to VARCHAR(100),
    tags TEXT[]
);

CREATE TABLE IF NOT EXISTS browser_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL,
    url TEXT NOT NULL,
    selector TEXT,
    action TEXT,
    data JSONB,
    screenshot BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    result JSONB
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_browser_actions_status ON browser_actions(status);
CREATE INDEX IF NOT EXISTS idx_browser_actions_type ON browser_actions(type);
CREATE INDEX IF NOT EXISTS idx_browser_actions_created_at ON browser_actions(created_at);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO users (email, name, role) VALUES
    ('admin@bharat-agents.com', 'Admin User', 'admin'),
    ('user@bharat-agents.com', 'Regular User', 'user')
ON CONFLICT (email) DO NOTHING;

-- Create a function to get tasks with pagination
CREATE OR REPLACE FUNCTION get_tasks_paginated(
    p_page INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 10,
    p_status VARCHAR DEFAULT NULL,
    p_priority VARCHAR DEFAULT NULL,
    p_assigned_to VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(200),
    description TEXT,
    status VARCHAR(20),
    priority VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    assigned_to VARCHAR(100),
    tags TEXT[],
    total_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered_tasks AS (
        SELECT *,
               COUNT(*) OVER() as total_count
        FROM tasks
        WHERE (p_status IS NULL OR status = p_status)
          AND (p_priority IS NULL OR priority = p_priority)
          AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
    )
    SELECT 
        ft.id,
        ft.title,
        ft.description,
        ft.status,
        ft.priority,
        ft.created_at,
        ft.updated_at,
        ft.due_date,
        ft.assigned_to,
        ft.tags,
        ft.total_count
    FROM filtered_tasks ft
    ORDER BY ft.created_at DESC
    LIMIT p_limit
    OFFSET (p_page - 1) * p_limit;
END;
$$ LANGUAGE plpgsql;
