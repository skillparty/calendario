-- Migración para sistema de calendarios grupales
-- Ejecutar en Supabase SQL Editor

BEGIN;

-- Tabla de grupos/calendarios compartidos
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de miembros de grupos
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Tabla de invitaciones pendientes
CREATE TABLE IF NOT EXISTS group_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_github_username TEXT NOT NULL,
    invited_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(group_id, invited_github_username)
);

-- Agregar columna group_id a tasks (NULL = tarea personal)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;

-- Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_user_id ON group_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_status ON group_invitations(status);
CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON tasks(group_id);

-- Función para actualizar updated_at en groups
CREATE OR REPLACE FUNCTION update_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_groups_updated_at_trigger ON groups;
CREATE TRIGGER update_groups_updated_at_trigger
    BEFORE UPDATE ON groups
    FOR EACH ROW
    EXECUTE FUNCTION update_groups_updated_at();

-- Políticas RLS (Row Level Security)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;

-- Política: Los miembros del grupo pueden ver el grupo
CREATE POLICY "Group members can view groups"
    ON groups FOR SELECT
    USING (
        id IN (
            SELECT group_id FROM group_members WHERE user_id = auth.uid()::uuid
        )
    );

-- Política: El creador puede actualizar el grupo
CREATE POLICY "Group creator can update group"
    ON groups FOR UPDATE
    USING (created_by = auth.uid()::uuid);

-- Política: Los admins pueden invitar miembros
CREATE POLICY "Group admins can invite members"
    ON group_invitations FOR INSERT
    WITH CHECK (
        invited_by = auth.uid()::uuid AND
        group_id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = auth.uid()::uuid AND role = 'admin'
        )
    );

-- Política: Los miembros pueden ver tareas del grupo
CREATE POLICY "Group members can view group tasks"
    ON tasks FOR SELECT
    USING (
        group_id IS NULL OR
        group_id IN (
            SELECT group_id FROM group_members WHERE user_id = auth.uid()::uuid
        )
    );

COMMIT;

-- NOTAS:
-- 1. Cada grupo tiene un creador (admin inicial)
-- 2. Se pueden invitar usuarios por su username de GitHub
-- 3. Las tareas pueden ser personales (group_id = NULL) o grupales (group_id != NULL)
-- 4. Los miembros pueden ser 'admin' o 'member'
-- 5. Las invitaciones pueden estar 'pending', 'accepted' o 'rejected'
