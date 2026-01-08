# 🔍 Verificación del Sistema de Calendarios Grupales

## ✅ Estado Actual de la Migración SQL

**✓ Completado**: Has ejecutado la migración SQL en Supabase correctamente.

## ⚠️ Estado del Deployment de Vercel

### Verificación Realizada

```bash
$ curl https://calendario-backend-one.vercel.app/
{
    "message": "Calendario Backend API",
    "version": "2.0.0",  # ❌ Debería ser 2.1.0
    "endpoints": {
        "auth": "/api/auth/github",
        "tasks": "/api/tasks",
        "health": "/api/health"
        # ❌ Falta "groups": "/api/groups"
    }
}
```

**Resultado**: El backend **todavía está en la versión antigua**. Vercel necesita terminar el deployment.

## 🕐 ¿Cuánto Tiempo Falta?

- **Commits pusheados**: Hace ~5-10 minutos
- **Tiempo típico de deployment**: 3-7 minutos
- **Estado**: Vercel probablemente está procesando el deployment ahora mismo

## 📋 Pasos de Verificación Manual

### Opción 1: Script Automatizado (RECOMENDADO)

1. **Abre tu aplicación** en el navegador: https://calendario-frontend-ashy.vercel.app
2. **Abre la consola del navegador**: Presiona F12 (Windows/Linux) o Cmd+Option+J (Mac)
3. **Copia y pega este código**:

```javascript
// Cargar el script de verificación
const script = document.createElement('script');
script.src = 'https://raw.githubusercontent.com/skillparty/calendario/main/verify-groups-setup.js';
document.head.appendChild(script);

// O ejecutar directamente:
fetch('https://raw.githubusercontent.com/skillparty/calendario/main/verify-groups-setup.js')
  .then(r => r.text())
  .then(code => eval(code));
```

Esto ejecutará una verificación completa y te mostrará un reporte detallado.

### Opción 2: Verificación Manual Paso a Paso

#### 1. Verificar Backend (Desde la Terminal)

```bash
# Verificar versión del backend
curl https://calendario-backend-one.vercel.app/

# Debería devolver:
# {
#   "message": "Calendario Backend API - Supabase Edition",
#   "version": "2.1.0",
#   "endpoints": {
#     "auth": "/api/auth/github",
#     "tasks": "/api/tasks",
#     "groups": "/api/groups",  # ← Este debe existir
#     "cron": "/api/cron"
#   }
# }
```

#### 2. Verificar Endpoint de Grupos (Necesita Autenticación)

Desde la consola del navegador (F12):

```javascript
// 1. Obtener tu token JWT
const user = JSON.parse(localStorage.getItem('calendarUser'));
console.log('Token:', user?.jwt ? 'Presente ✓' : 'No encontrado ✗');

// 2. Probar endpoint de grupos
const apiUrl = 'https://calendario-backend-one.vercel.app';
fetch(`${apiUrl}/api/groups`, {
  headers: {
    'Authorization': `Bearer ${user.jwt}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => console.log('Grupos:', data))
.catch(e => console.error('Error:', e));
```

**Respuesta esperada:**
```javascript
{
  success: true,
  data: [] // Array de grupos (vacío si no has creado ninguno)
}
```

#### 3. Verificar Tablas en Supabase

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Table Editor**
4. Verifica que existan estas tablas:
   - ✓ `groups`
   - ✓ `group_members`
   - ✓ `group_invitations`
5. Verifica que la tabla `tasks` tenga la columna `group_id`

## 🎯 Próximos Pasos Según el Resultado

### Caso A: Backend Aún en Versión 2.0.0

**Acción**: Espera 5 minutos más y vuelve a verificar.

```bash
# Ejecuta cada 2 minutos hasta que veas versión 2.1.0
watch -n 120 'curl -s https://calendario-backend-one.vercel.app/ | python3 -m json.tool'
```

### Caso B: Backend en Versión 2.1.0 pero Error 401/403

**Acción**: Tu token JWT puede haber expirado.

1. En tu app, haz clic en **Salir**
2. Vuelve a hacer clic en **Iniciar Sesión**
3. Autoriza con GitHub nuevamente
4. Intenta crear un grupo

### Caso C: Backend en Versión 2.1.0 pero Error 500

**Acción**: Hay un problema con las tablas de Supabase.

1. Ve a Supabase → SQL Editor
2. Ejecuta este query de verificación:

```sql
-- Verificar que las tablas existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('groups', 'group_members', 'group_invitations');

-- Verificar columna group_id en tasks
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' 
  AND column_name = 'group_id';
```

Deberías ver 3 tablas en el primer query y 1 columna en el segundo.

### Caso D: Todo Funciona ✅

**Acción**: ¡Crea tu primer grupo!

1. En tu app, haz clic en el botón **⚙️** (configuración) en el header
2. Haz clic en **➕ Crear Nuevo Grupo**
3. Completa el formulario:
   - Nombre: "Mi Primer Grupo"
   - Descripción: "Grupo de prueba"
4. Haz clic en **Crear Grupo**

Deberías ver una notificación de éxito y el grupo en la lista.

## 🐛 Troubleshooting Común

### Error: "Route not found"

**Causa**: Vercel no ha deployado los cambios aún.
**Solución**: Espera 5-10 minutos y recarga la página.

### Error: "Access token required"

**Causa**: No estás logueado o el token expiró.
**Solución**: Cierra sesión e inicia sesión nuevamente.

### Error: "User not found"

**Causa**: El token JWT contiene un userId que no existe en Supabase.
**Solución**: Verifica que tu usuario esté en la tabla `users` de Supabase.

### Error: "Database error" o "relation does not exist"

**Causa**: La migración SQL no se ejecutó correctamente.
**Solución**: Vuelve a ejecutar la migración SQL en Supabase.

## 📊 Checklist Final

Antes de crear un grupo, verifica:

- [ ] Backend responde con versión **2.1.0**
- [ ] Endpoint `/api/groups` aparece en la lista de endpoints
- [ ] Estás **logueado** en la aplicación
- [ ] El selector de calendario aparece en el header
- [ ] Las 3 tablas existen en Supabase
- [ ] La columna `group_id` existe en la tabla `tasks`

## 🆘 Si Nada Funciona

Comparte esta información:

1. **Versión del backend**:
   ```bash
   curl https://calendario-backend-one.vercel.app/
   ```

2. **Estado de autenticación** (desde consola del navegador):
   ```javascript
   const user = JSON.parse(localStorage.getItem('calendarUser') || '{}');
   console.log('Logged in:', !!user.jwt);
   console.log('Username:', user.user?.username);
   ```

3. **Error completo** de la consola del navegador (F12 → Console)

4. **Tablas en Supabase**:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

---

**Tiempo estimado hasta que todo funcione**: 5-10 minutos (esperando deployment)

**Siguiente paso**: Ejecuta el script de verificación en la consola del navegador.
