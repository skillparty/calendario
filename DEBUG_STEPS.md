# 🔍 Pasos de Debug para Login con GitHub

## Estado Actual
✅ Backend funcionando: https://backend-eight-zeta-snldyompdv.vercel.app
✅ Ruta /api/health: OK
✅ Ruta /api/auth/test: OK
✅ Ruta /api/auth/github: Esperando código

## 🎯 Sigue estos pasos para encontrar el error:

### Paso 1: Abre la consola del navegador
1. Abre https://calendario-frontend-ashy.vercel.app
2. Presiona `Cmd + Option + J` (en Mac) o `F12`
3. Ve a la pestaña **Console**
4. Limpia la consola (botón 🚫)

### Paso 2: Intenta hacer login
1. Haz clic en el botón "Login con GitHub"
2. **ANTES DE AUTORIZAR** en GitHub, toma captura de pantalla de:
   - La URL a la que te redirige GitHub
   - Debe ser algo como: `https://github.com/login/oauth/authorize?client_id=Ov231iO2tcNCvRBxrHov&...`

### Paso 3: Autoriza y observa el error
1. Autoriza la aplicación en GitHub
2. Observa a qué URL te redirige
3. **Toma captura de pantalla de:**
   - La URL en la barra del navegador
   - Todos los mensajes en la consola (pestaña Console)
   - Si hay errores en la pestaña Network

### Paso 4: Revisa Network
1. Ve a la pestaña **Network** en DevTools
2. Busca la petición a `/api/auth/github`
3. Haz clic en ella
4. Ve a la pestaña **Response**
5. **Toma captura de pantalla** de la respuesta

## 🔎 Qué buscar:

### Si ves error 404:
- **¿En qué URL aparece el 404?**
  - ¿En GitHub? → Problema con GitHub OAuth App
  - ¿En tu frontend? → Problema de routing
  - ¿En el backend? → Problema con la ruta de API

### Si ves error CORS:
- El backend necesita permitir tu dominio frontend

### Si ves "Failed to fetch":
- Problema de red o backend caído

### Si no pasa nada:
- JavaScript puede estar fallando silenciosamente

## 🚀 Mientras tanto, prueba esto:

Abre la consola en https://calendario-frontend-ashy.vercel.app y pega esto:

```javascript
console.log('Testing config:');
console.log('GITHUB_CLIENT_ID:', typeof GITHUB_CLIENT_ID !== 'undefined' ? GITHUB_CLIENT_ID : 'NOT DEFINED');
console.log('GITHUB_REDIRECT_URI:', typeof GITHUB_REDIRECT_URI !== 'undefined' ? GITHUB_REDIRECT_URI : 'NOT DEFINED');
console.log('API_BASE_URL:', typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'NOT DEFINED');
console.log('OAUTH_PROXY_URL:', typeof OAUTH_PROXY_URL !== 'undefined' ? OAUTH_PROXY_URL : 'NOT DEFINED');
```

**Envíame los resultados** de estas pruebas para poder ayudarte mejor.

## 📋 Checklist rápido:

- [ ] Backend responde en: https://backend-eight-zeta-snldyompdv.vercel.app/api/health
- [ ] Frontend carga en: https://calendario-frontend-ashy.vercel.app
- [ ] GitHub OAuth App callback URL es: https://calendario-frontend-ashy.vercel.app
- [ ] Variables de entorno configuradas en Vercel proyecto "backend":
  - [ ] GITHUB_CLIENT_ID=Ov231iO2tcNCvRBxrHov
  - [ ] GITHUB_CLIENT_SECRET=(tu secret)
  - [ ] FRONTEND_URL=https://calendario-frontend-ashy.vercel.app
