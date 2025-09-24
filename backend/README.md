# Calendario Backend API

Backend API REST para la aplicación Calendario Digital, construido con Node.js, Express y PostgreSQL.

## Características

- 🔐 Autenticación GitHub OAuth con JWT
- 📝 CRUD completo de tareas con validación
- 🗄️ Base de datos PostgreSQL con migraciones
- 🔄 Sincronización automática con GitHub Gist
- 📊 Estadísticas y filtros avanzados
- 🛡️ Middleware de seguridad (CORS, Rate Limiting, Helmet)
- 📱 API preparada para múltiples clientes
- 🚀 Listo para deployment en Railway/Render/Vercel

## Estructura del Proyecto

```
backend/
├── package.json          # Dependencias y scripts
├── server.js             # Servidor principal
├── routes/
│   ├── auth.js           # Autenticación GitHub OAuth
│   ├── tasks.js          # CRUD de tareas
│   └── sync.js           # Backup/restore Gist
├── middleware/
│   ├── auth.js           # JWT y autorización
│   └── errorHandler.js   # Manejo de errores
├── utils/
│   ├── db.js             # Conexión PostgreSQL
│   ├── github.js         # Cliente GitHub API
│   └── logger.js         # Logging con Winston
└── .env.example          # Variables de entorno
```

## Instalación y Configuración

### 1. Instalación

```bash
cd backend
npm install
```

### 2. Variables de Entorno

Copia `.env.example` a `.env` y configura:

```bash
cp .env.example .env
```

Edita `.env` con tus valores:

```env
# Base de datos (ejemplo con Supabase)
DATABASE_URL=postgresql://postgres:password@db.supabase.co:5432/postgres

# GitHub OAuth (desde tu GitHub App)
GITHUB_CLIENT_ID=tu_client_id
GITHUB_CLIENT_SECRET=tu_client_secret

# JWT (genera una clave segura)
JWT_SECRET=tu_clave_super_secreta_aqui

# Frontend URL
FRONTEND_URL=https://skillparty.github.io
```

### 3. Base de Datos

El servidor inicializa automáticamente las tablas al arrancar. Para bases de datos nuevas:

```bash
npm run migrate  # (opcional, el server.js lo hace automáticamente)
```

### 4. Ejecutar

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

El servidor estará disponible en `http://localhost:3000`

## API Endpoints

### Autenticación

- `POST /api/auth/github` - Exchange OAuth code por token
- `GET /api/auth/me` - Información del usuario actual

### Tareas

- `GET /api/tasks` - Listar tareas (con filtros)
- `POST /api/tasks` - Crear tarea
- `GET /api/tasks/:id` - Obtener tarea específica
- `PUT /api/tasks/:id` - Actualizar tarea
- `DELETE /api/tasks/:id` - Eliminar tarea
- `PATCH /api/tasks/:id/toggle` - Alternar completado
- `GET /api/tasks/stats/summary` - Estadísticas

### Sincronización

- `POST /api/sync/backup` - Backup a GitHub Gist
- `POST /api/sync/restore` - Restaurar desde Gist
- `GET /api/sync/status` - Estado de sincronización
- `DELETE /api/sync/backup` - Eliminar backup

## Filtros de Tareas

La API de tareas soporta múltiples filtros:

```
GET /api/tasks?date=2025-01-15           # Tareas de fecha específica
GET /api/tasks?start_date=2025-01-01&end_date=2025-01-31  # Rango
GET /api/tasks?month=1&year=2025         # Mes específico
GET /api/tasks?completed=false           # Solo pendientes
GET /api/tasks?limit=20&offset=40        # Paginación
```

## Deployment

### Railway

1. Conecta tu repositorio
2. Configura variables de entorno
3. Railway detecta automáticamente Node.js
4. La app se despliega en `https://tu-app.railway.app`

### Render

1. Crea un nuevo Web Service
2. Conecta el repositorio
3. Configura:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Añade variables de entorno

### Vercel (Serverless)

Requiere adaptación para funciones serverless. Contacta para implementación específica.

## Base de Datos

### Esquema

```sql
-- Usuarios
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  github_id INTEGER UNIQUE,
  username VARCHAR(255),
  name VARCHAR(255),
  email VARCHAR(255),
  avatar_url TEXT,
  access_token TEXT,
  gist_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tareas
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  is_reminder BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 1,
  tags TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Providers Recomendados

- **Supabase**: PostgreSQL gratis hasta 500MB
- **PlanetScale**: MySQL serverless (requiere adaptación)
- **Railway**: PostgreSQL con plan gratuito limitado

## Integración con Frontend

Para conectar con tu frontend actual:

1. Asegúrate de que `API_BASE_URL` en `api.js` apunte a tu backend:
   ```js
   // api.js
   export const API_BASE_URL = 'https://tu-backend.railway.app';
   ```

2. En `app.js`, verifica que `OAUTH_PROXY_URL` apunte a `${API_BASE_URL}/api/auth/github` (o a tu propio proxy):
   ```js
   // app.js
   const OAUTH_PROXY_URL = API_BASE_URL + '/api/auth/github';
   ```

3. Actualiza las llamadas API para usar JWT:
   ```js
   const response = await fetch('https://tu-backend.railway.app/api/tasks', {
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     }
   });
   ```

## Seguridad

- ✅ CORS configurado para tu dominio
- ✅ Rate limiting (100 req/15min por IP)
- ✅ Helmet para headers de seguridad
- ✅ Validación de entrada con express-validator
- ✅ JWT con expiración
- ✅ Consultas parametrizadas (anti-SQL injection)

## Monitoreo

Logs disponibles en:
- Consola (desarrollo)
- `logs/` (producción)
- Provider dashboard (Railway/Render)

## Scripts Disponibles

```bash
npm start          # Servidor producción
npm run dev        # Desarrollo con nodemon
npm run migrate    # Inicializar DB (opcional)
npm test           # Tests (pendiente)
```

## Troubleshooting

### Error de conexión DB
- Verifica `DATABASE_URL` en `.env`
- Asegúrate que la DB acepta conexiones externas

### CORS errors
- Configura `FRONTEND_URL` correctamente
- Verifica que el dominio está en `corsOptions`

### GitHub OAuth falla
- Revisa `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET`
- Confirma que la redirect URI está configurada en GitHub

## Próximas Funcionalidades

- [ ] WebSockets para sync tiempo real
- [ ] Notificaciones push
- [ ] API rate limiting por usuario
- [ ] Tests automatizados
- [ ] Docker containerization
- [ ] Métricas y analytics