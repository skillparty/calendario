# Calendar10 Backend

API backend para Calendar10 con **Express + Supabase**, desplegada como función serverless en **Vercel**.

## Arquitectura actual

- Producción (Vercel): `backend/api/index.js`
- Desarrollo local clásico: `backend/server.js`
- Base de datos: Supabase PostgreSQL
- Auth: GitHub OAuth + JWT

## Requisitos

- Node.js 18+

## Instalación

```bash
cd backend
npm install
```

## Variables de entorno

Configura `backend/.env`:

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

## Scripts

```bash
npm start        # Ejecuta server.js
npm run dev      # server.js con nodemon
npm run migrate  # Ejecuta run-migrations.js
npm test
```

## Endpoints principales

- `GET /api/health`
- `POST /api/auth/github`
- `GET /api/auth/me`
- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`

## Deploy en Vercel

1. Crear proyecto con **Root Directory** = `backend`
2. Mantener `backend/vercel.json` (apunta a `api/index.js`)
3. Configurar variables de entorno en Vercel
4. Deploy

## Verificación rápida

1. `GET /api/health` devuelve estado OK
2. Login de GitHub funciona
3. CRUD de tareas funciona con JWT

## Seguridad

- No exponer `SUPABASE_SERVICE_KEY` ni `GITHUB_CLIENT_SECRET`
- No subir `.env` al repositorio
- Verificar `FRONTEND_URL` correcto para CORS