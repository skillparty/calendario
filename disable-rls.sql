-- Deshabilitar temporalmente RLS para pruebas
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

-- O si prefieres mantener RLS pero permitir todo (para desarrollo):
-- DROP POLICY IF EXISTS "Users can view own data" ON users;
-- DROP POLICY IF EXISTS "Users can update own data" ON users;
-- DROP POLICY IF EXISTS "Users can insert own data" ON users;
-- DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
-- DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
-- DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
-- DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;

-- Crear políticas permisivas para desarrollo (permitir todo)
-- CREATE POLICY "Allow all for users" ON users FOR ALL USING (true);
-- CREATE POLICY "Allow all for tasks" ON tasks FOR ALL USING (true);
