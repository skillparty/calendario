# Migration Scripts para PostgreSQL

Este directorio contiene scripts de migración para el backend del Calendario.

## Archivos

- `001_initial_schema.sql` - Schema inicial con tablas users y tasks
- `002_add_indexes.sql` - Índices para optimización de performance  
- `003_add_triggers.sql` - Triggers para updated_at automático
- `004_add_time_column.sql` - Columna `time` en tareas
- `005_fix_date_column.sql` - Ajustes para tareas sin fecha
- `006_performance_optimizations.sql` - Vistas e índices de rendimiento
- `007_add_email_reminders.sql` - Campos e índices para recordatorios por email

Además existen scripts auxiliares de mantenimiento:

- `add_is_reminder.sql`
- `add_tags_column.sql`
- `fix_rls_policies.sql`

## Uso

### Automático (Recomendado)
Usa el runner del proyecto:

```bash
npm run migrate
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
\i migrations/004_add_time_column.sql
\i migrations/005_fix_date_column.sql
\i migrations/006_performance_optimizations.sql
\i migrations/007_add_email_reminders.sql
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
2. Guardarlo en este directorio con prefijo numérico
3. Ejecutar `npm run migrate`
4. Usar transacciones para rollback seguro:

```sql
BEGIN;

-- Tu migración aquí
ALTER TABLE tasks ADD COLUMN new_field VARCHAR(100);

-- Si algo falla, automáticamente hace rollback
COMMIT;
```