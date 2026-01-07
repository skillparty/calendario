# ⚠️ ACCIÓN REQUERIDA: Ejecutar Migración SQL

## 🚨 Importante

El error 404 en `/api/groups` se está solucionando, pero **DEBES ejecutar la migración SQL en Supabase** para que las tablas de grupos existan.

## 📋 Pasos para Ejecutar la Migración

### 1. Abrir Supabase Dashboard

1. Ve a https://supabase.com/dashboard
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto de Calendar10

### 2. Abrir SQL Editor

1. En el menú lateral izquierdo, busca **SQL Editor**
2. Haz clic en **SQL Editor**
3. Haz clic en **New Query**

### 3. Copiar el SQL de Migración

Abre el archivo: `backend/migrations/008_add_group_calendars.sql`

O copia el siguiente SQL completo:

```sql
-- Migration 008: Add Group Calendars Support

-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Create group_invitations table
CREATE TABLE IF NOT EXISTS group_invitations (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_user UUID REFERENCES users(id) ON DELETE CASCADE,
    github_username VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT check_invited_identifier CHECK (
        (invited_user IS NOT NULL) OR (github_username IS NOT NULL)
    )
);

-- Add group_id column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_group_id ON group_invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_invited_user ON group_invitations(invited_user);
CREATE INDEX IF NOT EXISTS idx_group_invitations_status ON group_invitations(status);
CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON tasks(group_id);

-- Create trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;

-- Groups policies
DROP POLICY IF EXISTS groups_select_policy ON groups;
CREATE POLICY groups_select_policy ON groups
    FOR SELECT USING (
        created_by = (SELECT id FROM users WHERE id = created_by) OR
        id IN (SELECT group_id FROM group_members WHERE user_id = (SELECT id FROM users))
    );

DROP POLICY IF EXISTS groups_insert_policy ON groups;
CREATE POLICY groups_insert_policy ON groups
    FOR INSERT WITH CHECK (
        created_by = (SELECT id FROM users WHERE id = created_by)
    );

DROP POLICY IF EXISTS groups_update_policy ON groups;
CREATE POLICY groups_update_policy ON groups
    FOR UPDATE USING (
        id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = (SELECT id FROM users) AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS groups_delete_policy ON groups;
CREATE POLICY groups_delete_policy ON groups
    FOR DELETE USING (
        id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = (SELECT id FROM users) AND role = 'admin'
        )
    );

-- Group members policies
DROP POLICY IF EXISTS group_members_select_policy ON group_members;
CREATE POLICY group_members_select_policy ON group_members
    FOR SELECT USING (
        group_id IN (SELECT group_id FROM group_members WHERE user_id = (SELECT id FROM users))
    );

DROP POLICY IF EXISTS group_members_insert_policy ON group_members;
CREATE POLICY group_members_insert_policy ON group_members
    FOR INSERT WITH CHECK (
        group_id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = (SELECT id FROM users) AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS group_members_delete_policy ON group_members;
CREATE POLICY group_members_delete_policy ON group_members
    FOR DELETE USING (
        group_id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = (SELECT id FROM users) AND role = 'admin'
        )
    );

-- Group invitations policies
DROP POLICY IF EXISTS group_invitations_select_policy ON group_invitations;
CREATE POLICY group_invitations_select_policy ON group_invitations
    FOR SELECT USING (
        invited_user = (SELECT id FROM users) OR
        group_id IN (SELECT group_id FROM group_members WHERE user_id = (SELECT id FROM users))
    );

DROP POLICY IF EXISTS group_invitations_insert_policy ON group_invitations;
CREATE POLICY group_invitations_insert_policy ON group_invitations
    FOR INSERT WITH CHECK (
        group_id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = (SELECT id FROM users) AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS group_invitations_update_policy ON group_invitations;
CREATE POLICY group_invitations_update_policy ON group_invitations
    FOR UPDATE USING (
        invited_user = (SELECT id FROM users)
    );

-- Tasks policies for groups
DROP POLICY IF EXISTS tasks_select_policy ON tasks;
CREATE POLICY tasks_select_policy ON tasks
    FOR SELECT USING (
        user_id = (SELECT id FROM users) OR
        (group_id IS NOT NULL AND group_id IN (
            SELECT group_id FROM group_members WHERE user_id = (SELECT id FROM users)
        ))
    );

DROP POLICY IF EXISTS tasks_insert_policy ON tasks;
CREATE POLICY tasks_insert_policy ON tasks
    FOR INSERT WITH CHECK (
        user_id = (SELECT id FROM users) AND (
            group_id IS NULL OR
            group_id IN (SELECT group_id FROM group_members WHERE user_id = (SELECT id FROM users))
        )
    );

DROP POLICY IF EXISTS tasks_update_policy ON tasks;
CREATE POLICY tasks_update_policy ON tasks
    FOR UPDATE USING (
        user_id = (SELECT id FROM users) OR
        (group_id IS NOT NULL AND group_id IN (
            SELECT group_id FROM group_members WHERE user_id = (SELECT id FROM users)
        ))
    );

DROP POLICY IF EXISTS tasks_delete_policy ON tasks;
CREATE POLICY tasks_delete_policy ON tasks
    FOR DELETE USING (
        user_id = (SELECT id FROM users) OR
        (group_id IS NOT NULL AND group_id IN (
            SELECT group_id FROM group_members WHERE user_id = (SELECT id FROM users)
        ))
    );

-- Comments
COMMENT ON TABLE groups IS 'Collaborative calendar groups';
COMMENT ON TABLE group_members IS 'Members of each group with their roles';
COMMENT ON TABLE group_invitations IS 'Pending and historical invitations to groups';
COMMENT ON COLUMN tasks.group_id IS 'If set, this task belongs to a group calendar';
```

### 4. Ejecutar el SQL

1. Pega todo el SQL en el editor
2. Haz clic en **Run** (o presiona Ctrl+Enter / Cmd+Enter)
3. Espera a que termine (debería tomar ~10 segundos)
4. Verifica que veas el mensaje "Success. No rows returned"

### 5. Verificar que las Tablas se Crearon

1. En el menú lateral, ve a **Table Editor**
2. Deberías ver las nuevas tablas:
   - `groups`
   - `group_members`
   - `group_invitations`
3. La tabla `tasks` debería tener una nueva columna `group_id`

## ✅ Verificación Final

Después de ejecutar la migración:

1. **Recarga tu aplicación** frontend (Ctrl+R / Cmd+R)
2. **Cierra sesión y vuelve a iniciar sesión** (para refrescar el token)
3. **Intenta crear un grupo** nuevamente

Si todo salió bien, deberías poder crear grupos sin problemas.

## 🐛 Si Hay Errores

### Error: "relation already exists"

No hay problema, significa que algunas tablas ya existen. Continúa con el resto de la migración.

### Error: "permission denied"

1. Ve a **Database → Settings**
2. Verifica que Row Level Security esté habilitado
3. Verifica que tu usuario tenga permisos de admin

### Error: "column already exists"

No hay problema, el `IF NOT EXISTS` debería manejarlo. Si persiste, ignora ese error y continúa.

## 📞 Soporte

Si tienes problemas:
1. Copia el mensaje de error completo
2. Toma screenshot del SQL Editor
3. Reporta el problema con los logs

---

**⏰ Tiempo estimado**: 2-3 minutos

**✨ Después de esto, los calendarios grupales estarán 100% funcionales!**
