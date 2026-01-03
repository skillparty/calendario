# Deploy en Fly.io - Guía Completa

Fly.io es ideal para el backend del Calendario: no se duerme, PostgreSQL gratis, y excelente performance.

## 🚀 Setup Inicial

### 1. Instalar Fly CLI

```bash
# macOS (usando Homebrew)
brew install flyctl

# Verificar instalación
flyctl version
```

### 2. Crear cuenta y login

```bash
# Registrarse (abre navegador)
flyctl auth signup

# O login si ya tienes cuenta
flyctl auth login
```

### 3. Crear app desde el directorio backend

```bash
cd backend

# Crear app (interactivo)
flyctl apps create calendario-backend-tu-nombre

# O directamente
flyctl apps create --name calendario-backend-alejandro
```

## 📁 Configuración

### 1. Generar fly.toml

```bash
# Fly detecta automáticamente Node.js
flyctl launch

# Responder:
# - App name: calendario-backend-alejandro
# - Region: mad (Madrid - más cerca de España)
# - PostgreSQL: YES
# - Redis: NO
# - Deploy: NO (configuramos primero)
```

### 2. El archivo fly.toml generado:

```toml
# fly.toml generado automáticamente
app = "calendario-backend-alejandro"
primary_region = "mad"

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

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  timeout = "5s"
  path = "/api/health"

[processes]
  app = "npm start"
```

### 3. Configurar PostgreSQL

```bash
# Ver info de la DB creada
flyctl postgres list

# Obtener connection string
flyctl postgres connect -a calendario-backend-alejandro-db

# O ver la URL directamente
flyctl postgres db list -a calendario-backend-alejandro-db
```

## 🔐 Variables de Entorno

### Configurar secrets en Fly.io:

```bash
# GitHub OAuth
flyctl secrets set GITHUB_CLIENT_ID=tu_client_id
flyctl secrets set GITHUB_CLIENT_SECRET=tu_client_secret

# JWT Secret (generar uno nuevo)
flyctl secrets set JWT_SECRET=$(openssl rand -hex 64)

# Frontend URL
flyctl secrets set FRONTEND_URL=https://skillparty.github.io

# Database URL (Fly la configura automáticamente, pero puedes verificar)
flyctl secrets list
```

## 📦 Deploy

### 1. Primer deploy

```bash
# Deploy inicial
flyctl deploy

# Ver logs en tiempo real
flyctl logs
```

### 2. Verificar funcionamiento

```bash
# Ver status
flyctl status

# Test health check
curl https://calendario-backend-alejandro.fly.dev/api/health

# Ver URL de tu app
flyctl info
```

## 🗄️ Base de Datos

### Conectar y verificar schema:

```bash
# Conectar a PostgreSQL
flyctl postgres connect -a calendario-backend-alejandro-db

# Dentro de psql:
\dt    # Ver tablas
SELECT * FROM users LIMIT 5;
SELECT * FROM tasks LIMIT 5;
```

### Backup automático:
- ✅ Fly.io hace backups automáticos de PostgreSQL
- ✅ Retención de 7 días en plan gratuito

## 📊 Monitoreo

### Ver métricas:

```bash
# Logs en tiempo real
flyctl logs

# Métricas de CPU/RAM
flyctl metrics

# Status de máquinas
flyctl machine list
```

### Dashboard web:
- https://fly.io/dashboard/tu-app

## 🔧 Comandos Útiles

```bash
# Redeploy después de cambios
flyctl deploy

# Ver variables de entorno
flyctl secrets list

# Escalar (si necesitas más recursos)
flyctl scale count 1    # 1 instancia
flyctl scale memory 512 # 512MB RAM

# Logs específicos
flyctl logs --app calendario-backend-alejandro

# SSH a la máquina (debug)
flyctl ssh console

# Reiniciar app
flyctl machine restart
```

## 💰 Límites Plan Gratuito

- ✅ **3 apps** máximo
- ✅ **256MB RAM** por app (suficiente para Node.js)
- ✅ **3GB storage** para PostgreSQL
- ✅ **160GB bandwidth** outbound/mes
- ✅ **No se duerme** - siempre activo
- ✅ **SSL automático**

## 🔄 Auto-Deploy desde GitHub

### Setup con GitHub Actions:

1. Generar token de Fly:
```bash
flyctl auth token
```

2. Añadir como secret en GitHub:
- Ve a tu repo → Settings → Secrets → Actions
- Crear `FLY_API_TOKEN` con el token

3. Crear `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Fly.io
on:
  push:
    branches: [main]
    paths: ['backend/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        working-directory: ./backend
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

## 🚨 Troubleshooting

### App no arranca:
```bash
# Ver logs detallados
flyctl logs --app calendario-backend-alejandro

# Verificar health check
curl https://tu-app.fly.dev/api/health
```

### Error de DB:
```bash
# Verificar conexión
flyctl postgres connect -a tu-app-db

# Ver status de PostgreSQL
flyctl postgres list
```

### Cambiar configuración:
```bash
# Editar fly.toml y redeploy
flyctl deploy
```

## 🎯 URL Final

Tu backend estará disponible en:
`https://calendario-backend-alejandro.fly.dev`

Para integrar con frontend, usarás:
```javascript
const API_BASE_URL = 'https://calendario-backend-alejandro.fly.dev';
```

¡Fly.io es perfecto para tu calendario - siempre activo y gratis! 🚀