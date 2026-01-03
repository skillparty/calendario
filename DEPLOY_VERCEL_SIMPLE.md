# 🚀 Guía Simplificada de Deploy en Vercel

## 📋 Antes de Empezar

### 1. Genera tu JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
**Guarda este valor**, lo necesitarás después.

### 2. Obtén tus credenciales de Supabase
Ve a: https://supabase.com/dashboard/project/phdvhvvdvkmvdxgrkfei/settings/api

Copia y guarda:
- **URL**: `https://phdvhvvdvkmvdxgrkfei.supabase.co`
- **anon/public key**: (la clave anon)
- **service_role key**: (⚠️ mantener secreta)

### 3. Configura GitHub OAuth App
Ve a: https://github.com/settings/developers

Si no tienes una app, crea una nueva:
- **Application name**: Calendario10
- **Homepage URL**: `https://TU-FRONTEND.vercel.app` (actualizarás esto)
- **Authorization callback URL**: `https://TU-BACKEND.vercel.app/api/auth/github/callback` (actualizarás esto)

Guarda:
- **Client ID**
- **Client Secret**

---

## 🔨 PARTE 1: Crear Proyecto Backend

### Paso 1: Crear proyecto en Vercel
1. Ve a: https://vercel.com/new
2. Importa el repositorio: `skillparty/calendario`
3. **Project Name**: `calendario-backend` (o el nombre que prefieras)
4. **Framework Preset**: Other
5. ⚠️ **IMPORTANTE - Root Directory**: Escribe `backend` 
6. **NO toques nada más** (Build Command, Output Directory, Install Command - dejar en blanco)
7. Click **Deploy**

### Paso 2: Agregar Variables de Entorno
Mientras se deploya, ve a **Settings** → **Environment Variables**

Agrega estas variables (una por una):

```
SUPABASE_URL=https://phdvhvvdvkmvdxgrkfei.supabase.co
SUPABASE_ANON_KEY=[tu anon key de Supabase]
SUPABASE_SERVICE_KEY=[tu service_role key de Supabase]
JWT_SECRET=[el secreto que generaste en el paso 1]
GITHUB_CLIENT_ID=[tu GitHub client ID]
GITHUB_CLIENT_SECRET=[tu GitHub client secret]
NODE_ENV=production
FRONTEND_URL=https://TU-FRONTEND.vercel.app
```

⚠️ Para cada variable, selecciona: **Production**, **Preview** y **Development**

### Paso 3: Redeploy
1. Ve a tab **Deployments**
2. Click en los 3 puntos del último deployment
3. Click **Redeploy**
4. Espera a que termine (1-2 minutos)

### Paso 4: Probar Backend
Copia tu URL del backend (ej: `calendario-backend-xyz.vercel.app`)

Prueba en tu terminal:
```bash
curl https://TU-BACKEND.vercel.app/api/health
```

Deberías ver: `{"status":"OK","database":"Supabase"}`

✅ Si ves esto, **el backend funciona!**

---

## 🎨 PARTE 2: Crear Proyecto Frontend

### Paso 1: Actualizar código con URL del backend
En tu terminal:
```bash
cd /Users/alejandrorollano/Calendario
```

Abre el archivo `api.js` y busca la línea:
```javascript
: 'https://TU_BACKEND_AQUI.vercel.app';
```

Cámbiala por tu URL real del backend:
```javascript
: 'https://calendario-backend-xyz.vercel.app'; // Tu URL real
```

Guarda y haz commit:
```bash
git add api.js
git commit -m "config: actualizar URL del backend"
git push origin main
```

### Paso 2: Crear proyecto frontend en Vercel
1. Ve a: https://vercel.com/new
2. Importa el **mismo** repositorio: `skillparty/calendario`
3. **Project Name**: `calendario-frontend` (o el nombre que prefieras)
4. **Framework Preset**: Other
5. ⚠️ **IMPORTANTE - Root Directory**: Dejar en blanco (`.`)
6. Click **Deploy**

### Paso 3: Obtener URL del frontend
Una vez deployado, verás tu URL (ej: `calendario-frontend-xyz.vercel.app`)

---

## 🔗 PARTE 3: Conectar Todo

### Paso 1: Actualizar variables de entorno del backend
1. Ve al proyecto backend en Vercel
2. **Settings** → **Environment Variables**
3. Edita `FRONTEND_URL`
4. Cambia a tu URL real del frontend: `https://calendario-frontend-xyz.vercel.app`
5. **Save**
6. Ve a **Deployments** → Redeploy

### Paso 2: Actualizar GitHub OAuth App
1. Ve a: https://github.com/settings/developers
2. Edita tu OAuth App
3. Actualiza:
   - **Homepage URL**: `https://calendario-frontend-xyz.vercel.app` (tu URL real)
   - **Authorization callback URL**: `https://calendario-backend-xyz.vercel.app/api/auth/github/callback` (tu URL real)
4. **Save**

---

## ✅ PARTE 4: Probar Todo

### 1. Probar Backend
```bash
curl https://TU-BACKEND.vercel.app/api/health
```
✅ Debe devolver: `{"status":"OK","database":"Supabase"}`

### 2. Probar Frontend
1. Abre: `https://TU-FRONTEND.vercel.app`
2. Deberías ver el calendario
3. Click en **Login con GitHub**
4. Autoriza la app
5. Deberías volver al calendario logueado
6. Crea una tarea de prueba
7. Recarga la página - la tarea debe seguir ahí

✅ **Si todo esto funciona, ¡LISTO! 🎉**

---

## 🔥 Solución de Problemas

### Error: "Failed to load resource: 404" en auth
- Verifica que el `Root Directory` del backend sea `backend`
- Ve a backend en Vercel → Settings → General → Root Directory
- Debe decir `backend`, no `.`

### Error: "Auth HTTP 404"
- Verifica que la URL en `api.js` sea correcta
- Haz `git push` después de cambiar `api.js`
- Espera a que Vercel redeploy el frontend

### Login no funciona
- Verifica variables de entorno del backend
- Verifica callback URL en GitHub OAuth App
- Revisa logs en Vercel: Backend → Deployments → (último) → View Function Logs

### Las tareas no se guardan
- Verifica `SUPABASE_SERVICE_KEY` en variables de entorno
- Verifica que las tablas existan en Supabase

---

## 📝 Resumen de URLs

Una vez terminado, deberías tener:

- **Backend**: https://TU-BACKEND.vercel.app
- **Frontend**: https://TU-FRONTEND.vercel.app
- **GitHub OAuth Callback**: https://TU-BACKEND.vercel.app/api/auth/github/callback

¡Todo debe estar funcionando! 🚀
