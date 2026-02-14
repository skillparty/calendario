# 🧪 Guía de Pruebas - Calendar10 con Supabase

## Estado Actual
✅ Backend corriendo en `http://localhost:3000`
✅ Frontend corriendo en `http://localhost:8000`
✅ Supabase configurado con tablas creadas
✅ Listo para pruebas de autenticación y CRUD

---

## 1. Crear Usuario de Prueba en Supabase

**SQL Editor → Ejecutar:**
```sql
INSERT INTO users (id, username, email, github_id)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'usuario_prueba',
    'prueba@ejemplo.com',
    'test123'
);
```

---

## 2. Probar API manualmente (desde terminal)

### Health Check
```bash
curl http://localhost:3000/health
```

### Crear una tarea
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Mi primera tarea",
    "description": "Probando Supabase",
    "date": "2026-01-10",
    "time": "14:30",
    "priority": "alta"
  }'
```

### Obtener todas las tareas
```bash
curl http://localhost:3000/api/tasks
```

### Actualizar una tarea (reemplaza {task-id} con el ID real)
```bash
curl -X PUT http://localhost:3000/api/tasks/{task-id} \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tarea actualizada",
    "completed": true
  }'
```

### Eliminar una tarea
```bash
curl -X DELETE http://localhost:3000/api/tasks/{task-id}
```

---

## 3. Probar desde el Frontend

1. Abre `http://localhost:8000`
2. Intenta crear una tarea en el calendario
3. Verifica que se guarde en Supabase (ve a Table Editor → tasks)
4. Marca como completada
5. Elimínala

---

## 4. Verificar en Supabase

1. Ve a tu proyecto en Supabase
2. Click en **Table Editor**
3. Selecciona la tabla **tasks**
4. Deberías ver las tareas que creaste

---

## 🐛 Troubleshooting

### El backend no responde
```bash
# Verificar que esté corriendo
lsof -ti:3000

# Si no está, reiniciar
cd backend && node server.js
```

### Error "user_id no existe"
→ Asegúrate de haber creado el usuario de prueba en Supabase

### Error de CORS
→ Verifica que `FRONTEND_URL=http://localhost:8000` en `backend/.env`

### Las tareas no se guardan
→ Revisa los logs del backend y verifica las políticas RLS en Supabase

---

## 📊 Siguiente Paso: Deployment

Una vez que todo funcione localmente:
1. Sube el backend a Vercel
2. Actualiza `api.js` con la URL del backend en producción
3. Despliega el frontend en Vercel

Ver [`SUPABASE_DEPLOYMENT.md`](SUPABASE_DEPLOYMENT.md) para instrucciones completas.
