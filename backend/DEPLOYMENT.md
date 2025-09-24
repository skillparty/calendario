# Guía de Deployment - Calendario Backend

Esta guía te ayudará a desplegar el backend del Calendario en diferentes plataformas cloud.

## 🚀 Railway (Recomendado)

Railway es ideal para Node.js + PostgreSQL con configuración mínima.

### Paso a paso:

1. **Crear cuenta en Railway**: https://railway.app
2. **Conectar repositorio**:
   ```bash
   # Desde Railway dashboard
   New Project → Deploy from GitHub → Seleccionar repositorio
   ```

3. **Configurar variables de entorno**:
   ```
   NODE_ENV=production
   GITHUB_CLIENT_ID=tu_client_id_de_github
   GITHUB_CLIENT_SECRET=tu_client_secret_de_github
   JWT_SECRET=clave_super_secreta_aleatoria
   FRONTEND_URL=https://skillparty.github.io
   ```

4. **Añadir PostgreSQL**:
   ```bash
   # En Railway dashboard
   Add Service → Database → PostgreSQL
   # Railway te dará automáticamente DATABASE_URL
   ```

5. **Deploy automático**: Railway detecta `package.json` y despliega automáticamente.

6. **Obtener URL**: Tu backend estará en `https://tu-proyecto.railway.app`

### Configuración avanzada Railway:

```bash
# railway.json ya está incluido para optimizar el deployment
{
  "build": { "builder": "nixpacks" },
  "deploy": { "healthcheckPath": "/api/health" }
}
```

## 🎨 Render

Render ofrece tier gratuito con limitaciones pero buena estabilidad.

### Configuración:

1. **Crear cuenta**: https://render.com
2. **Nuevo Web Service**:
   - Repository: Tu repositorio GitHub
   - Branch: `main`
   - Root Directory: `backend`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Variables de entorno** (mismo que Railway):
   ```
   NODE_ENV=production
   GITHUB_CLIENT_ID=...
   GITHUB_CLIENT_SECRET=...
   JWT_SECRET=...
   FRONTEND_URL=https://skillparty.github.io
   ```

4. **Base de datos PostgreSQL**:
   - Create → PostgreSQL
   - Copiar `DATABASE_URL` a tu Web Service

## ☁️ Vercel (Serverless)

Vercel es excelente para frontend, funciona con backend pero con limitaciones.

### Configuración:

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy desde backend/
cd backend
vercel

# Configurar variables en dashboard.vercel.com
```

**Limitaciones de Vercel**:
- Functions timeout a 10s (plan gratuito)
- Conexiones DB limitadas (requiere connection pooling)
- Mejor para APIs simples

## 🐳 Docker (VPS/Cloud)

Para máximo control en VPS o cloud providers.

### Build y run:

```bash
# Build imagen
docker build -t calendario-backend .

# Run con variables de entorno
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e GITHUB_CLIENT_ID="..." \
  -e GITHUB_CLIENT_SECRET="..." \
  -e JWT_SECRET="..." \
  -e FRONTEND_URL="https://skillparty.github.io" \
  calendario-backend
```

### Docker Compose (con PostgreSQL):

```bash
# Crear .env con tus variables
cp .env.example .env

# Levantar stack completo
docker-compose up -d

# Ver logs
docker-compose logs -f app
```

## 🗄️ Base de Datos

### Opciones recomendadas:

1. **Supabase** (Gratis hasta 500MB):
   ```
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
   ```

2. **Railway PostgreSQL** (incluido con plan):
   ```
   # Automáticamente configurado al añadir PostgreSQL service
   ```

3. **Render PostgreSQL** (plan gratuito limitado):
   ```
   # URL proporcionada al crear PostgreSQL service
   ```

### Schema inicialización:

El backend inicializa automáticamente las tablas al arrancar. Para verificar:

```sql
-- Conectar a tu DB y verificar
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Deberías ver: users, tasks
```

## 🔧 Configuración Frontend

Después del deployment, actualiza tu frontend para apuntar al backend:

- Edita `frontend/api.js` (o `api.js` en la raíz del frontend) y establece la constante `API_BASE_URL`.
- Verifica en `frontend/app.js` (o `app.js` en la raíz del frontend) que `OAUTH_PROXY_URL` apunte a `${API_BASE_URL}/api/auth/github`.

```javascript
// api.js
export const API_BASE_URL = 'https://tu-backend.railway.app';

// app.js
const OAUTH_PROXY_URL = API_BASE_URL + '/api/auth/github';
```

La aplicación cargará tareas con paginación automáticamente al iniciar sesión (JWT) mediante `loadTasksIntoState()` y sincronizará cambios con `pushLocalTasksToBackend()`.

## 📊 Monitoreo y Logs

### Railway:
```bash
# Ver logs en tiempo real
railway logs

# Métricas en dashboard
https://railway.app/project/tu-proyecto
```

### Render:
```bash
# Logs disponibles en dashboard
https://dashboard.render.com/web/tu-servicio/logs
```

### Docker:
```bash
# Logs del contenedor
docker logs -f calendario-backend

# Entrar al contenedor para debug
docker exec -it calendario-backend sh
```

## 🛠️ Troubleshooting

### Error: "Cannot connect to database"
```bash
# Verificar URL de conexión
echo $DATABASE_URL

# Test manual de conexión
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()').then(console.log).catch(console.error);
"
```

### Error: "GitHub OAuth failed"
```bash
# Verificar variables GitHub
echo $GITHUB_CLIENT_ID
echo $GITHUB_CLIENT_SECRET

# Verificar que redirect URI en GitHub App incluye tu dominio backend
```

### Error: "CORS blocked"
```bash
# Asegurar que FRONTEND_URL está configurado correctamente
# Y que coincide exactamente con el dominio de tu frontend
```

### Error: "JWT malformed"
```bash
# Generar nuevo JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 📈 Optimizaciones Production

### Railway/Render:
- ✅ Auto-scaling incluido
- ✅ HTTPS automático
- ✅ Monitoring básico incluido

### Mejoras adicionales:
```javascript
// En server.js, ya incluido:
- Rate limiting (100 req/15min)
- Security headers (Helmet)
- Compression (gzip)
- Error logging (Winston)
- Health checks (/api/health)
```

### Métricas recomendadas:
- Response time < 200ms
- 99% uptime
- < 5 errores/hora en logs

¡Tu backend está listo para producción! 🎉