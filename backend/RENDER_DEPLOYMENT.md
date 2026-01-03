# Deploy en Render - Alternativa Sólida

Render es una excelente alternativa a Railway con plan gratuito generoso.

## 🎯 Ventajas de Render

- ✅ **750 horas/mes gratis** (24/7 todo el mes)
- ✅ **PostgreSQL gratis** por 90 días
- ✅ **SSL automático**
- ✅ **Deploy automático** desde GitHub
- ✅ **No límite de proyectos**
- ⚠️ Se duerme tras 15min inactividad (arranque en 10-30s)

## 🚀 Setup Paso a Paso

### 1. Crear cuenta

1. Ve a https://render.com
2. Registrarte con GitHub
3. Autorizar acceso al repositorio

### 2. Crear PostgreSQL Database

1. Dashboard → New → PostgreSQL
2. Configurar:
   - **Name**: `calendario-db`
   - **Database**: `calendario`
   - **User**: `calendario_user`
   - **Region**: Oregon (gratis)
   - **Plan**: Free
3. Crear database
4. **Copiar la Database URL** (la necesitarás)

### 3. Crear Web Service

1. Dashboard → New → Web Service
2. Conectar repositorio `calendario`
3. Configurar:
   - **Name**: `calendario-backend`
   - **Environment**: Node
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### 4. Variables de Entorno

En la sección Environment del Web Service:

```env
NODE_ENV=production
DATABASE_URL=postgresql://calendario_user:password@dpg-xxx.oregon-postgres.render.com/calendario
GITHUB_CLIENT_ID=tu_client_id_github
GITHUB_CLIENT_SECRET=tu_client_secret_github
JWT_SECRET=clave_super_secreta_64_caracteres
FRONTEND_URL=https://skillparty.github.io
```

### 5. Deploy

1. Hacer clic en "Create Web Service"
2. Render detectará automáticamente Node.js
3. El deploy tomará 2-5 minutos
4. Tu app estará en: `https://calendario-backend.onrender.com`

## 🔧 Configuración Avanzada

### Health Checks

Render detectará automáticamente `/api/health` de tu código.

### Custom Domain (Opcional)

Si tienes dominio propio:
1. Settings → Custom Domains
2. Añadir tu dominio
3. Configurar DNS CNAME

### Logs

```bash
# Ver logs en dashboard
Settings → Logs → View Logs

# O usar CLI (opcional)
npm install -g @render/cli
render logs
```

## 📊 Monitoreo

### Dashboard Render:
- CPU, RAM, y bandwidth usage
- Deploy history
- Logs en tiempo real
- Métricas de performance

### Alertas automáticas:
- Deploy failures
- Service downtime
- High resource usage

## 🔄 Auto-Deploy

### GitHub Integration:
- ✅ Auto-deploy en push a `main`
- ✅ Deploy previews en PRs
- ✅ Rollback automático si falla

### Manual Deploy:
- Dashboard → Manual Deploy
- O push a la rama configurada

## 💾 Base de Datos

### Conexión:
```bash
# Desde tu máquina local
psql postgresql://calendario_user:password@dpg-xxx.oregon-postgres.render.com/calendario

# Verificar tablas
\dt
```

### Backups:
- ✅ Snapshots automáticos diarios
- ✅ Retención 7 días (plan gratuito)
- ✅ Restore con un click

### Upgrade a Paid:
Después de 90 días gratuitos:
- **Starter**: $7/mes (shared CPU, 1GB RAM)
- **Standard**: $20/mes (dedicated CPU, 4GB RAM)

## 🚨 Limitaciones Plan Gratuito

### Web Service:
- ✅ 750 horas/mes compute
- ✅ 100GB bandwidth/mes
- ✅ SSL automático
- ⚠️ Se duerme tras 15min inactividad
- ⚠️ Arranque lento post-sleep (10-30s)

### PostgreSQL:
- ✅ 1GB storage
- ✅ 90 días gratis
- ⚠️ Después $7/mes mínimo

## 🔧 Optimizaciones

### Mantener app despierta:
```javascript
// Opcional: ping cada 14 minutos para evitar sleep
// (cuidado con los límites de bandwidth)
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    fetch(`${process.env.RENDER_EXTERNAL_URL}/api/health`);
  }, 14 * 60 * 1000); // 14 minutos
}
```

### Headers de cache:
Ya incluidos en tu `server.js` con helmet.

## 🛠️ Troubleshooting

### Deploy falla:
```bash
# Verificar logs en dashboard
# Común: falta variable de entorno o error en package.json
```

### Database connection error:
```bash
# Verificar DATABASE_URL en variables de entorno
# Asegurar que PostgreSQL service está running
```

### App se duerme mucho:
```bash
# Considerar upgrade a plan paid ($7/mes)
# O usar servicio de "keep alive" externo
```

## 📈 Siguiente paso después de 90 días

### Opción 1: Pagar PostgreSQL ($7/mes)
- Mantener todo en Render
- Simplicidad máxima

### Opción 2: PostgreSQL externo gratuito
- **Supabase**: 500MB gratis permanente
- **PlanetScale**: 5GB gratis (MySQL)
- **MongoDB Atlas**: 512MB gratis

### Opción 3: Migrar a Fly.io
- PostgreSQL gratis permanente
- No se duerme
- Mejor performance

## 🎯 URL Final

Tu backend estará en:
`https://calendario-backend.onrender.com`

¡Render es excelente para empezar - 750 horas gratis son suficientes para un proyecto personal! 🚀