#!/bin/bash

# Script de deployment para Railway

set -e

echo "🚀 Iniciando deployment..."

# 1. Build de la aplicación
echo "📦 Instalando dependencias..."
npm ci --only=production

# 2. Verificar variables de entorno requeridas
echo "🔍 Verificando configuración..."
required_vars=("DATABASE_URL" "GITHUB_CLIENT_ID" "GITHUB_CLIENT_SECRET" "JWT_SECRET")

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: Variable de entorno $var no está configurada"
        exit 1
    fi
done

echo "✅ Variables de entorno verificadas"

# 3. Ejecutar migraciones de base de datos
echo "🗄️ Inicializando base de datos..."
npm run migrate || echo "⚠️  Migración falló o ya está aplicada"

# 4. Verificar conectividad de la base de datos
echo "🔗 Verificando conexión a la base de datos..."
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()')
  .then(() => { console.log('✅ Conexión a DB exitosa'); pool.end(); })
  .catch(err => { console.error('❌ Error de conexión a DB:', err.message); process.exit(1); });
"

echo "🎉 Deployment completado exitosamente"
echo "🌐 Aplicación lista en: $RAILWAY_PUBLIC_DOMAIN o puerto 3000"