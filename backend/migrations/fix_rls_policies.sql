-- Eliminar políticas redundantes antiguas (probablemente creadas manualmente o por migraciones anteriores)
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;
DROP POLICY IF EXISTS "tasks_select_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON tasks;

-- Crear un único conjunto de políticas consolidadas
CREATE POLICY "tasks_policy_select" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tasks_policy_insert" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_policy_update" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tasks_policy_delete" ON tasks FOR DELETE USING (auth.uid() = user_id);
