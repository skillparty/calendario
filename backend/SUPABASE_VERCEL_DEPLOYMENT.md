# Deploy con Supabase + Vercel - Solución 100% Gratuita

Combinación poderosa: Supabase (PostgreSQL gratis permanente) + Vercel (serverless gratis).

## 🎯 Ventajas

- ✅ **100% gratuito permanente**
- ✅ **No se duerme nunca**
- ✅ **Supabase**: 500MB PostgreSQL gratis para siempre
- ✅ **Vercel**: Hosting serverless ilimitado
- ✅ **Auto-scaling** automático
- ✅ **Edge network** global
- ⚠️ Requiere adaptar backend para serverless

## 🗄️ Parte 1: Setup Supabase (Database)

### 1. Crear proyecto Supabase

1. Ve a https://supabase.com
2. Sign up con GitHub
3. Create New Project:
   - **Name**: `calendario-db`
   - **Database Password**: `tu_password_seguro`
   - **Region**: West Europe (más cerca)

### 2. Configurar Database

1. En Supabase dashboard → SQL Editor
2. Ejecutar el schema inicial:

```sql
-- Ejecutar en Supabase SQL Editor
BEGIN;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    github_id INTEGER UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    avatar_url TEXT,
    access_token TEXT,
    gist_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    is_reminder BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 5),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_completed ON tasks(user_id, completed);

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

### 3. Obtener connection string

1. Settings → Database
2. Copiar **Connection string**:
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

## ☁️ Parte 2: Adaptar Backend para Vercel

### 1. Crear estructura serverless

Necesitamos adaptar tu backend actual para Vercel Functions:

```bash
# Desde tu directorio actual
mkdir -p api
```

### 2. Crear handler principal

```javascript
// api/index.js - Handler principal para Vercel
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const syncRoutes = require('./routes/sync');

const app = express();

// Middleware
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

// CORS
app.use(cors({
  origin: [
    'https://skillparty.github.io',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/sync', syncRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    platform: 'vercel'
  });
});

// Export for Vercel
module.exports = app;
```

### 3. Adaptaciones necesarias

- **Database connections**: Pool → single connections
- **File system**: Usar variables de entorno para logs
- **Stateless**: Sin almacenamiento local

## 🚀 Parte 3: Deploy en Vercel

### 1. Instalar Vercel CLI

```bash
npm i -g vercel
```

### 2. Configurar proyecto

```bash
cd backend
vercel
```

Responder:
- **Set up and deploy**: Yes
- **Which scope**: tu-usuario
- **Project name**: calendario-backend
- **Directory**: ./
- **Override settings**: No

### 3. Configurar variables de entorno

```bash
# Desde backend/
vercel env add DATABASE_URL
# Pegar tu Supabase connection string

vercel env add GITHUB_CLIENT_ID
# Tu GitHub client ID

vercel env add GITHUB_CLIENT_SECRET
# Tu GitHub client secret

vercel env add JWT_SECRET
# Clave secreta para JWT

vercel env add FRONTEND_URL
# https://skillparty.github.io
```

### 4. Deploy final

```bash
vercel --prod
```

Tu API estará en: `https://calendario-backend.vercel.app`

## 🔧 Configuración Adicional

### Auto-deploy desde GitHub

1. Ve a https://vercel.com/dashboard
2. Import Git Repository
3. Conectar tu repo `calendario`
4. Configurar:
   - **Framework**: Other
   - **Root Directory**: `backend`
   - **Build Command**: `npm run build` (opcional)
   - **Output Directory**: (dejar vacío)

### Variables de entorno en dashboard

En Vercel dashboard → tu proyecto → Settings → Environment Variables:
- Añadir todas las variables necesarias
- Aplicar a Production, Preview, y Development

## 📊 Límites Plan Gratuito

### Supabase:
- ✅ **500MB** database storage
- ✅ **2GB** bandwidth/mes
- ✅ **50K** auth users
- ✅ **500K** edge function invocations

### Vercel:
- ✅ **100GB** bandwidth/mes
- ✅ **100** serverless function executions/día
- ✅ **10s** function timeout
- ✅ **50MB** function size

## 🔄 Monitoreo

### Supabase Dashboard:
- Database performance
- SQL query analyzer
- Real-time logs
- Auth users management

### Vercel Dashboard:
- Function invocations
- Performance metrics
- Error tracking
- Deploy logs

## 🚨 Consideraciones Serverless

### Connection pooling:
```javascript
// Usar connection simple en lugar de pool
const { Client } = require('pg');

const getDBClient = () => {
  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
};
```

### Timeout handling:
```javascript
// Timeouts más cortos para Vercel
const client = getDBClient();
client.connect();
// Hacer query
client.end(); // Cerrar inmediatamente
```

## 🎯 URL Final

- **Backend API**: `https://calendario-backend.vercel.app`
- **Database**: Supabase dashboard para gestión
- **Logs**: Vercel dashboard para monitoring

Esta solución es **100% gratuita permanente** y perfecta para proyectos personales! 🚀