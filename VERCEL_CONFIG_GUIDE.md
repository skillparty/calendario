# Guía de Configuración en Vercel

## Estado Actual
✅ Proyecto frontend: `calendario` - https://calendario-smoky.vercel.app  
✅ Proyecto backend: `backend` - https://backend-khaki-psi-28.vercel.app

## 1️⃣ Configurar Variables de Entorno en Backend

Ve a: https://vercel.com/dashboard → **backend** → Settings → Environment Variables

Agrega las siguientes variables:

### Variables Requeridas:

```
SUPABASE_URL=https://phdvhvvdvkmvdxgrkfei.supabase.co
SUPABASE_ANON_KEY=[Tu Anon Key de Supabase]
SUPABASE_SERVICE_KEY=[Tu Service Key de Supabase]
JWT_SECRET=[Genera un secreto aleatorio fuerte]
GITHUB_CLIENT_ID=[Tu GitHub OAuth Client ID]
GITHUB_CLIENT_SECRET=[Tu GitHub OAuth Client Secret]
NODE_ENV=production
FRONTEND_URL=https://calendario-smoky.vercel.app
```

### ⚙️ Cómo obtener cada valor:

#### Supabase Keys:
1. Ve a: https://supabase.com/dashboard/project/phdvhvvdvkmvdxgrkfei/settings/api
2. Copia:
   - `SUPABASE_URL`: URL del proyecto
   - `SUPABASE_ANON_KEY`: anon/public key
   - `SUPABASE_SERVICE_KEY`: service_role key (⚠️ Esta es secreta!)

#### JWT Secret:
Genera uno aleatorio ejecutando en tu terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### GitHub OAuth:
1. Ve a: https://github.com/settings/developers
2. Crea una nueva OAuth App o usa una existente
3. Configurar:
   - Homepage URL: `https://calendario-smoky.vercel.app`
   - Authorization callback URL: `https://backend-khaki-psi-28.vercel.app/api/auth/github/callback`
4. Copia Client ID y Client Secret

## 2️⃣ Verificar el Frontend

La URL del backend ya está configurada correctamente en `api.js`:
```javascript
const API_BASE_URL = 'https://backend-khaki-psi-28.vercel.app';
```

✅ No se necesitan cambios aquí.

## 3️⃣ Re-deployar Proyectos

Después de agregar las variables de entorno:

### Opción A: Desde Vercel Dashboard
1. Ve a cada proyecto → Deployments
2. Click en los 3 puntos del último deployment
3. Click "Redeploy"

### Opción B: Desde Git (recomendado)
Haz un commit vacío para forzar re-deploy:
```bash
cd /Users/alejandrorollano/Calendario
git commit --allow-empty -m "chore: trigger vercel redeploy with env vars"
git push origin main
```

## 4️⃣ Verificar que Todo Funciona

### Probar Backend:
```bash
curl https://backend-khaki-psi-28.vercel.app/api/health
```
Deberías ver: `{"status":"OK","database":"Supabase"}`

### Probar Frontend:
1. Abre: https://calendario-smoky.vercel.app
2. Click en "Login con GitHub"
3. Verifica que puedas crear tareas

## 5️⃣ Configuración de Dominio (Opcional)

Si quieres usar tu propio dominio:
1. Ve a proyecto → Settings → Domains
2. Agrega tu dominio personalizado
3. Configura los DNS según las instrucciones de Vercel

## 🔧 Solución de Problemas

### Si el backend no responde:
1. Verifica que todas las env vars estén configuradas
2. Revisa los logs en: Vercel Dashboard → backend → Deployments → (último) → Logs

### Si el login no funciona:
1. Verifica que `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET` sean correctos
2. Verifica que la callback URL en GitHub sea: `https://backend-khaki-psi-28.vercel.app/api/auth/github/callback`

### Si las tareas no se guardan:
1. Verifica que `SUPABASE_SERVICE_KEY` esté configurada correctamente
2. Revisa que las tablas en Supabase existan (ejecuta migrations si es necesario)

## 📝 Notas Importantes

- ⚠️ **NUNCA** compartas `SUPABASE_SERVICE_KEY` o `GITHUB_CLIENT_SECRET` públicamente
- ✅ Las variables de entorno en Vercel están encriptadas y seguras
- 🔄 Después de cambiar variables de entorno, siempre re-deploya el proyecto
- 📊 Los logs en tiempo real están disponibles en el dashboard de Vercel

## ✅ Checklist de Configuración

- [ ] Agregar todas las variables de entorno al backend en Vercel
- [ ] Verificar GitHub OAuth App callback URL
- [ ] Re-deployar backend
- [ ] Probar endpoint `/api/health`
- [ ] Probar login desde el frontend
- [ ] Crear una tarea de prueba
- [ ] Verificar que la tarea se guarda en Supabase

---

## 🎯 Siguiente Paso

**Ahora necesitas:**
1. Ir a Vercel Dashboard del proyecto backend
2. Agregar todas las variables de entorno listadas arriba
3. Re-deployar

¿Necesitas ayuda para obtener alguna de estas credenciales?
