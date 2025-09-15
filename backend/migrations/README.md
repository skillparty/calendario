# Migration Scripts para PostgreSQL

Este directorio contiene scripts de migración para el backend del Calendario.

## Archivos

- `001_initial_schema.sql` - Schema inicial con tablas users y tasks
- `002_add_indexes.sql` - Índices para optimización de performance  
- `003_add_triggers.sql` - Triggers para updated_at automático

## Uso

### Automático (Recomendado)
El servidor ejecuta automáticamente las migraciones al iniciar usando `utils/db.js`:

```bash
npm start  # Ejecuta migraciones automáticamente
```

### Manual
Si necesitas ejecutar migraciones manualmente:

```bash
# Conectar a tu base de datos
psql $DATABASE_URL

# Ejecutar en orden
\i migrations/001_initial_schema.sql
\i migrations/002_add_indexes.sql  
\i migrations/003_add_triggers.sql
```

### Verificar estado
```sql
-- Ver tablas creadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Ver índices
SELECT indexname, tablename FROM pg_indexes 
WHERE schemaname = 'public';
```

## Nuevas migraciones

Para añadir nuevas migraciones:

1. Crear archivo `00X_description.sql`
2. Añadir a `utils/db.js` en función `initDatabase()`
3. Usar transacciones para rollback seguro:

```sql
BEGIN;

-- Tu migración aquí
ALTER TABLE tasks ADD COLUMN new_field VARCHAR(100);

-- Si algo falla, automáticamente hace rollback
COMMIT;
```