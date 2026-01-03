# Fly.io Setup para Bolivia (Cochabamba)

Guía específica para deployar desde Bolivia con configuración optimizada.

## 🌍 Configuración Regional

### 1. Instalar Fly CLI

```bash
# macOS
brew install flyctl

# Linux/WSL (si usas Windows)
curl -L https://fly.io/install.sh | sh

# Verificar instalación
flyctl version
```

### 2. Crear cuenta

```bash
# Registrarse (funciona desde cualquier país)
flyctl auth signup

# Usar email/password o GitHub
# No hay restricciones geográficas
```

### 3. Configurar región óptima

```bash
cd backend

# Crear app con región Miami (mejor para Bolivia)
flyctl apps create calendario-backend-alejandro --region mia

# O si prefieres São Paulo
flyctl apps create calendario-backend-alejandro --region gru
```

## 📍 Regiones Recomendadas desde Cochabamba

### Latencia aproximada:
- **mia (Miami)**: ~170ms ⭐ Recomendado
- **gru (São Paulo)**: ~200ms 
- **scl (Santiago)**: ~250ms
- **iad (Virginia)**: ~180ms
- **lax (Los Angeles)**: ~220ms

### Test de latencia:
```bash
# Test ping desde tu ubicación
ping mia.fly.dev
ping gru.fly.dev
ping scl.fly.dev
```

## 🚀 Deploy Optimizado

### 1. Generar fly.toml optimizado:

```bash
flyctl launch --region mia --no-deploy

# Configurar:
# - App name: calendario-backend-alejandro
# - Region: mia (Miami)
# - PostgreSQL: YES
# - Redis: NO
```

### 2. Archivo fly.toml optimizado para LATAM:

```toml
app = "calendario-backend-alejandro"
primary_region = "mia"  # Miami - mejor para Bolivia

[build]

[env]
  NODE_ENV = "production"
  PORT = "8080"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

  # Health check optimizado para latencia LATAM
  [[http_service.checks]]
    grace_period = "15s"  # Más tiempo por latencia
    interval = "60s"      # Menos frecuente
    method = "GET"
    timeout = "10s"       # Timeout más generoso
    path = "/api/health"

[processes]
  app = "npm start"

# Configuración específica para mejor performance desde LATAM
[[statics]]
  guest_path = "/app/public"
  url_prefix = "/static/"
```

### 3. PostgreSQL en la misma región:

```bash
# PostgreSQL también en Miami
flyctl postgres create --region mia --name calendario-db-alejandro

# Conectar a tu app
flyctl postgres attach calendario-db-alejandro
```

## 🔐 Variables de Entorno

```bash
# Configurar secrets (funciona desde cualquier ubicación)
flyctl secrets set GITHUB_CLIENT_ID=tu_client_id
flyctl secrets set GITHUB_CLIENT_SECRET=tu_client_secret
flyctl secrets set JWT_SECRET=$(openssl rand -hex 64)
flyctl secrets set FRONTEND_URL=https://skillparty.github.io
```

## 📊 Consideraciones de Latencia

### Para mejorar performance desde Bolivia:

1. **CDN automático**: Fly.io incluye edge caching
2. **Keep-alive**: Conexiones persistentes reducen latencia
3. **Compression**: Gzip automático para menos transferencia

### En tu backend (ya incluido):
```javascript
// Timeouts más generosos para LATAM
app.use(timeout('30s'));  // 30 segundos timeout

// Compression para reducir transferencia
app.use(compression());
```

## 💰 Plan Gratuito desde Bolivia

### Límites (iguales globalmente):
- ✅ **3 apps gratis**
- ✅ **256MB RAM** por app
- ✅ **3GB PostgreSQL storage**
- ✅ **160GB bandwidth/mes**
- ✅ **No restricciones geográficas**

### Facturación:
- No se requiere tarjeta de crédito para plan gratuito
- Si necesitas upgrade, acepta tarjetas internacionales

## 🛠️ Comandos Optimizados

### Deploy con mejor tolerancia a latencia:
```bash
# Deploy con timeout extendido
flyctl deploy --remote-only --build-timeout 600

# Ver logs (puede tomar más tiempo cargar)
flyctl logs --region mia

# Status con región específica
flyctl status --app calendario-backend-alejandro
```

### Monitoreo desde Bolivia:
```bash
# Métricas regionales
flyctl metrics --region mia

# Test de conectividad
curl -w "@curl-format.txt" https://calendario-backend-alejandro.fly.dev/api/health
```

### Formato para curl timing (crear curl-format.txt):
```
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
```

## 🌐 Alternativas si Fly.io presenta problemas

### Backup options desde Bolivia:

1. **Render** (también global):
   - Región Oregon disponible
   - ~250ms desde Bolivia
   - Plan gratuito generoso

2. **Vercel** (edge network):
   - CDN automático mundial
   - Serverless functions globales
   - Latencia optimizada automáticamente

## 🚨 Troubleshooting desde Bolivia

### Si el deploy es muy lento:
```bash
# Usar build remoto (en datacenter de Fly)
flyctl deploy --remote-only

# Verificar conectividad
ping fly.io
traceroute fly.io
```

### Si hay timeouts:
```bash
# Aumentar timeouts en fly.toml
grace_period = "20s"
timeout = "15s"
interval = "90s"
```

## 🎯 URL Final

Tu backend estará en:
`https://calendario-backend-alejandro.fly.dev`

**Performance esperada desde Cochabamba:**
- Latencia: ~170ms (muy buena para la región)
- Uptime: 99.9%
- Velocidad: Excelente con compression

¡Fly.io es perfecto para desarrolladores en Bolivia! 🇧🇴🚀