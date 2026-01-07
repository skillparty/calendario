# Verificación y Solución del Error 404 en /api/groups

## 🔍 Diagnóstico del Problema

El error `404 - Route not found` en `/api/groups` se debe a:

1. ✅ **Las rutas de grupos existen** en `backend/routes/groups.js`
2. ✅ **Las rutas están registradas** en `backend/server.js`
3. ⚠️ **El middleware de autenticación estaba usando usuario hardcodeado**
4. ⚠️ **Vercel necesita re-deployarse** para cargar las nuevas rutas

## ✅ Soluciones Implementadas

### 1. Autenticación JWT Real (Commit 9b3c8bd)

**Antes:**
```javascript
const authenticate = (req, res, next) => {
  req.user = {
    id: '00000000-0000-0000-0000-000000000001',
    username: 'usuario_prueba'
  };
  next();
};
```

**Después:**
```javascript
const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Access token required', 401);
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, JWT_SECRET);
  
  const { data: user, error } = await supabase
    .from('users')
    .select('id, github_id, username, email, avatar_url')
    .eq('id', decoded.userId)
    .single();

  if (error || !user) {
    throw new AppError('User not found', 401);
  }

  req.user = user;
  next();
});
```

### 2. Archivos Actualizados

- ✅ `backend/routes/groups.js` - JWT auth implementado
- ✅ `backend/routes/tasks-supabase.js` - JWT auth implementado
- ✅ `backend/middleware/auth.js` - generateToken actualizado para soportar objetos
- ✅ `backend/server.js` - Versión actualizada a 2.1.0

### 3. Deployment en Vercel

**Commits pusheados:**
- `c25996b` - Actualizar versión y documentación de endpoints
- `9b3c8bd` - Implementar autenticación JWT real

**Status:** Vercel está deployando automáticamente. Espera ~2-5 minutos.

## 🔧 Próximos Pasos

### Paso 1: Ejecutar Migración SQL en Supabase

⚠️ **MUY IMPORTANTE**: Debes ejecutar la migración de base de datos si aún no lo has hecho.

1. Ve a tu panel de **Supabase** (https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **SQL Editor**
4. Abre el archivo `backend/migrations/008_add_group_calendars.sql`
5. Copia todo el contenido
6. Pégalo en el SQL Editor de Supabase
7. Haz clic en **Run**

**El contenido del archivo es:**

```sql
-- Migration 008: Add Group Calendars Support
-- This migration adds tables and policies for collaborative group calendars

-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create group_members table (many-to-many relationship)
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_group_id ON group_invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_invited_user ON group_invitations(invited_user);
CREATE INDEX IF NOT EXISTS idx_group_invitations_status ON group_invitations(status);
CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON tasks(group_id);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;

-- Groups policies
-- Users can see groups they are members of
CREATE POLICY groups_select_policy ON groups
    FOR SELECT USING (
        id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    );

-- Users can create groups (they become admin automatically)
CREATE POLICY groups_insert_policy ON groups
    FOR INSERT WITH CHECK (created_by = auth.uid());

-- Only group admins can update groups
CREATE POLICY groups_update_policy ON groups
    FOR UPDATE USING (
        id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Only group admins can delete groups
CREATE POLICY groups_delete_policy ON groups
    FOR DELETE USING (
        id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Group members policies
-- Users can see members of groups they belong to
CREATE POLICY group_members_select_policy ON group_members
    FOR SELECT USING (
        group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    );

-- Only admins can add members
CREATE POLICY group_members_insert_policy ON group_members
    FOR INSERT WITH CHECK (
        group_id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Only admins can remove members
CREATE POLICY group_members_delete_policy ON group_members
    FOR DELETE USING (
        group_id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Group invitations policies
-- Users can see invitations for groups they belong to, or invitations sent to them
CREATE POLICY group_invitations_select_policy ON group_invitations
    FOR SELECT USING (
        invited_user = auth.uid() OR
        group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    );

-- Only group admins can create invitations
CREATE POLICY group_invitations_insert_policy ON group_invitations
    FOR INSERT WITH CHECK (
        group_id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Users can update their own invitations (accept/reject)
CREATE POLICY group_invitations_update_policy ON group_invitations
    FOR UPDATE USING (invited_user = auth.uid());

-- Tasks policies for groups
-- Update tasks policy to allow group members to see group tasks
DROP POLICY IF EXISTS tasks_select_policy ON tasks;
CREATE POLICY tasks_select_policy ON tasks
    FOR SELECT USING (
        user_id = auth.uid() OR
        (group_id IS NOT NULL AND group_id IN (
            SELECT group_id FROM group_members WHERE user_id = auth.uid()
        ))
    );

-- Group members can insert tasks for their groups
DROP POLICY IF EXISTS tasks_insert_policy ON tasks;
CREATE POLICY tasks_insert_policy ON tasks
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND (
            group_id IS NULL OR
            group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
        )
    );

-- Group members can update tasks in their groups
DROP POLICY IF EXISTS tasks_update_policy ON tasks;
CREATE POLICY tasks_update_policy ON tasks
    FOR UPDATE USING (
        user_id = auth.uid() OR
        (group_id IS NOT NULL AND group_id IN (
            SELECT group_id FROM group_members WHERE user_id = auth.uid()
        ))
    );

-- Group members can delete tasks in their groups
DROP POLICY IF EXISTS tasks_delete_policy ON tasks;
CREATE POLICY tasks_delete_policy ON tasks
    FOR DELETE USING (
        user_id = auth.uid() OR
        (group_id IS NOT NULL AND group_id IN (
            SELECT group_id FROM group_members WHERE user_id = auth.uid()
        ))
    );

-- Comments
COMMENT ON TABLE groups IS 'Collaborative calendar groups';
COMMENT ON TABLE group_members IS 'Members of each group with their roles';
COMMENT ON TABLE group_invitations IS 'Pending and historical invitations to groups';
COMMENT ON COLUMN tasks.group_id IS 'If set, this task belongs to a group calendar instead of personal';
```

### Paso 2: Verificar Deployment de Vercel

1. Ve a https://vercel.com/dashboard
2. Busca tu proyecto `calendario-backend`
3. Ve a la sección **Deployments**
4. Verifica que el último deployment esté en estado **Ready**
5. Verifica que el commit sea `9b3c8bd`

### Paso 3: Probar la API

Una vez que Vercel haya terminado el deployment (2-5 minutos), prueba:

```bash
# Verificar que el backend responde
curl https://calendario-backend-one.vercel.app/

# Debe devolver:
{
  "message": "Calendario Backend API - Supabase Edition",
  "version": "2.1.0",
  "endpoints": {
    "auth": "/api/auth/github",
    "tasks": "/api/tasks",
    "groups": "/api/groups",
    "cron": "/api/cron"
  }
}
```

### Paso 4: Intentar Crear Grupo Nuevamente

1. Recarga tu aplicación frontend
2. Asegúrate de estar logueado
3. Haz clic en el botón de configuración (⚙️)
4. Intenta crear un grupo

**Si sigue dando error:**
- Abre la consola del navegador (F12)
- Ve a la pestaña **Network**
- Busca la petición `/api/groups`
- Verifica el **Response Headers** y **Request Headers**
- Copia el error completo

## 🐛 Debugging

### Verificar Token JWT

En la consola del navegador:

```javascript
// Ver el token almacenado
console.log(localStorage.getItem('calendarUser'));

// Parsear el JWT (básico, no valida firma)
const token = JSON.parse(localStorage.getItem('calendarUser')).jwt;
const parts = token.split('.');
const payload = JSON.parse(atob(parts[1]));
console.log('JWT Payload:', payload);
```

### Verificar API Base URL

```javascript
// En la consola del navegador
import { API_BASE_URL } from './api.js';
console.log('API Base URL:', API_BASE_URL);
// Debe ser: https://calendario-backend-one.vercel.app
```

## 📞 Si Aún No Funciona

Proporciona la siguiente información:

1. **Logs de la consola** del navegador (completos)
2. **Request Headers** de la petición fallida
3. **Response Headers** de la petición fallida
4. **Payload** enviado en la petición
5. **Status del deployment** en Vercel
6. **Confirmación** de que ejecutaste la migración SQL

---

**Tiempo estimado de resolución**: 5-10 minutos (esperando deployment de Vercel)
