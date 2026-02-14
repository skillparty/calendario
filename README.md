# Calendar10

Aplicación web de calendario y agenda con frontend en JavaScript modular y backend en Node.js + Supabase.

## Stack actual

- Frontend: HTML, CSS, JavaScript (ES modules)
- Backend: Express serverless en Vercel (`backend/api/index.js`)
- Base de datos: Supabase PostgreSQL
- Auth: GitHub OAuth + JWT

## Ejecución local

### 1) Frontend

```bash
python3 -m http.server 8000
```

Abrir: `http://localhost:8000`

### 2) Backend

```bash
cd backend
npm install
npm run dev
```

Backend local: `http://localhost:3000`

## Variables de entorno del backend

Configura `backend/.env` con:

```env
NODE_ENV=development
PORT=3000
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_KEY=tu-service-role-key
GITHUB_CLIENT_ID=tu-client-id
GITHUB_CLIENT_SECRET=tu-client-secret
JWT_SECRET=tu-jwt-secret
FRONTEND_URL=http://localhost:8000
```

## Configuración de GitHub OAuth

1. Ve a GitHub Settings > Developer settings > OAuth Apps
2. Crea/edita tu OAuth App
3. Configura el callback URL con tu frontend en producción (por ejemplo Vercel)
4. Guarda `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET` en variables del backend

## Deployment (Vercel)

### Frontend

- Deploy del repositorio raíz en Vercel

### Backend

- Crear proyecto separado en Vercel con **Root Directory** `backend`
- El backend ya usa configuración serverless en `backend/vercel.json`
- Configurar todas las variables de entorno en Vercel (ver sección anterior)

## Notas

- `api.js` contiene la URL base del backend en producción.
- Nunca expongas `GITHUB_CLIENT_SECRET` ni `SUPABASE_SERVICE_KEY` en frontend.

## Licencia

Proyecto de uso personal/educativo.