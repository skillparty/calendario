# Guía de Deployment con Supabase

## 📋 Checklist de Configuración

### 1️⃣ Configuración de Supabase Database

1. **Ejecutar el script SQL**
   - Ve a tu proyecto en Supabase: https://app.supabase.com
   - Abre el **SQL Editor**
   - Copia y pega el contenido de `supabase-setup.sql`
   - Ejecuta el script (botón RUN o Ctrl+Enter)
   - Verifica que las tablas `users` y `tasks` se crearon correctamente en la pestaña **Table Editor**

### 2️⃣ Obtener Credenciales de Supabase

1. En tu proyecto de Supabase, ve a **Settings** → **API**
2. Copia estos valores:
   ```
   Project URL: https://xxxxx.supabase.co
   anon/public key: eyJhbG...
   service_role key: eyJhbG... (¡SECRETO! Solo para backend)
   ```

### 3️⃣ Configurar Variables de Entorno Local

1. Crea el archivo `.env` en la carpeta `backend/`:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edita `backend/.env` con tus credenciales:
   ```env
   NODE_ENV=development
   PORT=3000
   
   # Supabase
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_ANON_KEY=eyJhbG...tu-anon-key
   SUPABASE_SERVICE_KEY=eyJhbG...tu-service-key
   
   # GitHub OAuth (opcional)
   GITHUB_CLIENT_ID=tu-client-id
   GITHUB_CLIENT_SECRET=tu-client-secret
   
   # JWT
   JWT_SECRET=cambia-esto-por-algo-seguro
   JWT_EXPIRES_IN=7d
   
   # Frontend
   FRONTEND_URL=http://localhost:8079
   LOG_LEVEL=info
   ```

### 4️⃣ Probar Localmente

```bash
# Terminal 1: Backend
cd backend
npm install
npm start

# Terminal 2: Frontend  
cd ..
python3 server.py
```

Abre http://localhost:8079 y verifica que todo funcione.

---

## 🚀 Deployment en Producción

### Opción A: Vercel (Recomendado - GRATIS)

#### Frontend en Vercel:

1. Ve a https://vercel.com y haz login con GitHub
2. Click **Add New** → **Project**
3. Importa tu repositorio `calendario`
4. Configura:
   - **Framework Preset**: Other
   - **Build Command**: (dejar vacío)
   - **Output Directory**: `.` (raíz)
   - **Install Command**: `npm install` (si usas package.json)

5. Click **Deploy**

#### Backend API en Vercel:

1. En Vercel, crea un **nuevo proyecto** para el backend
2. Usa el mismo repositorio pero configura:
   - **Root Directory**: `backend`
   - **Framework Preset**: Other
   - **Build Command**: (dejar vacío)
   - **Output Directory**: `.`

3. **Variables de Entorno** (Settings → Environment Variables):
   ```
   NODE_ENV=production
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_ANON_KEY=tu-anon-key
   SUPABASE_SERVICE_KEY=tu-service-key
   GITHUB_CLIENT_ID=tu-client-id
   GITHUB_CLIENT_SECRET=tu-client-secret
   JWT_SECRET=tu-jwt-secret
   FRONTEND_URL=https://tu-frontend.vercel.app
   ```

4. Crea `backend/vercel.json`:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "server.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "server.js"
       }
     ]
   }
   ```

5. Click **Deploy**

### Opción B: Railway (Alternativa)

1. Ve a https://railway.app
2. Click **New Project** → **Deploy from GitHub repo**
3. Selecciona tu repositorio
4. Agrega las variables de entorno
5. Railway detectará automáticamente Node.js y desplegará

### Opción C: Render (Alternativa)

1. Ve a https://render.com
2. **New** → **Web Service**
3. Conecta tu repositorio
4. Configura:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Agrega las variables de entorno
6. Click **Create Web Service**

---

## 🔧 Actualizar Frontend para Producción

Edita `api.js` para usar la URL de tu backend en producción:

```javascript
const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://tu-backend.vercel.app/api'
    : 'http://localhost:3000/api';
```

---

## ✅ Verificación Final

1. ✅ Tablas creadas en Supabase
2. ✅ Backend desplegado y funcionando
3. ✅ Frontend desplegado y funcionando
4. ✅ Autenticación con GitHub funciona
5. ✅ CRUD de tareas funciona
6. ✅ Sincronización funciona

---

## 📝 Notas Importantes

- **NUNCA** subas el archivo `.env` al repositorio
- La `service_role key` es MUY SENSIBLE, solo úsala en el backend
- Supabase tiene un plan gratuito generoso: 500MB DB, 50k usuarios activos/mes
- Vercel/Railway/Render tienen planes gratuitos suficientes para este proyecto

---

## 🆘 Troubleshooting

### Error: "Invalid API key"
- Verifica que copiaste correctamente las keys de Supabase
- Asegúrate de usar la `anon key` para el frontend y `service_role key` para operaciones administrativas

### Error: "CORS"
- Verifica que `FRONTEND_URL` en el backend coincida con tu dominio de frontend
- En desarrollo usa `http://localhost:8079`

### Error: "No se pueden crear tareas"
- Verifica que las políticas RLS estén configuradas correctamente
- Revisa que el usuario esté autenticado correctamente

---

¿Necesitas ayuda? Revisa los logs en:
- Supabase: Dashboard → Logs
- Vercel: Tu proyecto → Deployments → [click en deployment] → Logs
