# Calendar10

Aplicación web de calendario y agenda con frontend en Svelte + Vite y backend en Node.js + Supabase.

## Stack actual

- Frontend: Svelte 5 + Vite + TypeScript (gradual)
- Backend: Express serverless en Vercel (`backend/api/index.js`)
- Base de datos: Supabase PostgreSQL
- Auth: GitHub OAuth + JWT

## Ejecución local

### 1) Frontend

```bash
npm install
npm run dev
```

Abrir: `http://localhost:3000`

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
FRONTEND_URL=http://localhost:3000
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

- `src/services/api.ts` contiene la URL base del backend en producción.
- Nunca expongas `GITHUB_CLIENT_SECRET` ni `SUPABASE_SERVICE_KEY` en frontend.

## QA Responsive Móvil

### Ejecutar matriz E2E mobile

```bash
npm run test:e2e:mobile
```

Modo visible (debug visual):

```bash
npm run test:e2e:mobile:headed
```

La matriz valida viewports representativos:

- 360x740 (compacto)
- 390x844 (estándar)
- 412x915 (grande)

Y cubre en cada uno:

- Navegación de módulos (`Calendario`, `Agenda`, `Semanal`)
- Layout usable de Calendario
- Presencia de `Acciones Rápidas` y `Resumen` en Agenda móvil
- Navegación y grilla de Semanal

### Checklist rápida antes de release móvil

1. Ejecutar `npm run test:e2e:mobile` y confirmar verde.
2. Probar manualmente en un dispositivo real Android y uno iOS.
3. Verificar que header no tape contenido en first-fold.
4. Verificar que `Acciones Rápidas` y `Resumen` se muestran en Agenda móvil.
5. Verificar navegación mensual/semanal y toques de botones (44px mínimo).
6. Validar que no haya scroll horizontal no deseado.

## Licencia

Proyecto de uso personal/educativo.