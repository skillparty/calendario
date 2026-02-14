# Guía de Deployment (Supabase + Vercel)

Este proyecto está estandarizado para:

- **Base de datos**: Supabase PostgreSQL
- **Backend**: Vercel serverless (`backend/api/index.js`)
- **Frontend**: Vercel (sitio estático)

## 1) Configurar Supabase

1. Ve a tu proyecto en https://app.supabase.com
2. Abre **SQL Editor**
3. Ejecuta `supabase-setup.sql`
4. Verifica que existan al menos las tablas `users` y `tasks`

## 2) Variables de entorno (backend)

En Vercel (proyecto backend), configura:

```env
NODE_ENV=production
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_KEY=tu-service-role-key
GITHUB_CLIENT_ID=tu-client-id
GITHUB_CLIENT_SECRET=tu-client-secret
JWT_SECRET=tu-jwt-secret
FRONTEND_URL=https://tu-frontend.vercel.app
```

Para desarrollo local (`backend/.env`):

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

## 3) Deploy en Vercel

### Frontend

1. Importa el repositorio (raíz) en Vercel
2. Deploy con configuración por defecto para sitio estático

### Backend

1. Crea otro proyecto en Vercel usando el mismo repositorio
2. Configura **Root Directory** = `backend`
3. Mantén el archivo existente `backend/vercel.json` (ya apunta a `api/index.js`)
4. Agrega las variables de entorno del backend
5. Deploy

## 4) Ajustar URL de backend en frontend

En `api.js`, define la URL de producción correcta de tu backend desplegado en Vercel.

## 5) Verificación rápida

1. `GET /api/health` responde OK
2. Login con GitHub funciona
3. Crear/editar/eliminar tarea funciona
4. La app carga tareas después del login

## Troubleshooting

### Error de CORS

- Verifica que `FRONTEND_URL` coincida exactamente con tu dominio frontend.

### Error de auth GitHub

- Revisa `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET`.
- Verifica el callback URL en tu OAuth App de GitHub.

### Error de Supabase

- Revisa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_KEY`.
- Verifica logs en Supabase Dashboard.

## Seguridad

- Nunca subas `.env` al repositorio.
- Nunca expongas `SUPABASE_SERVICE_KEY` ni `GITHUB_CLIENT_SECRET` en frontend.
