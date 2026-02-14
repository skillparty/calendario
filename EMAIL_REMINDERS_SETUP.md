# 📧 Guía de Configuración de Recordatorios por Email

## 🎯 Resumen

Tu aplicación ahora puede enviar recordatorios por email 60 minutos antes de cada tarea programada usando:
- **Resend** para envío de emails
- **Vercel Cron Jobs** para verificación automática cada minuto
- **Supabase** para tracking de recordatorios enviados

---

## 📋 Pasos de Configuración

### 1. Crear Cuenta en Resend

1. Ve a https://resend.com/signup
2. Crea una cuenta gratuita (3,000 emails/mes gratis)
3. Verifica tu email

### 2. Obtener API Key de Resend

1. Ve a **Settings** → **API Keys**
2. Clic en **Create API Key**
3. Dale un nombre: `calendario-app`
4. Copia la API key (empieza con `re_...`)

### 3. Configurar Dominio de Envío (Opcional pero Recomendado)

**Opción A: Usar dominio de prueba (rápido pero limitado)**
- Puedes usar `onboarding@resend.dev` (ya configurado por defecto)
- Solo funcionará para enviar a tu propio email registrado en Resend

**Opción B: Usar tu propio dominio (recomendado para producción)**
1. En Resend → **Domains** → **Add Domain**
2. Ingresa tu dominio (ej: `midominio.com`)
3. Agrega los registros DNS que te proporcionen:
   - SPF
   - DKIM
   - DMARC
4. Espera la verificación (~10 minutos)
5. Usa emails como `noreply@midominio.com`

### 4. Configurar Variables de Entorno en Vercel (Backend)

Ve a tu proyecto backend en Vercel → **Settings** → **Environment Variables**

Agrega estas variables:

```bash
# API Key de Resend (OBLIGATORIO)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxx

# Email remitente (OPCIONAL - usa el de tu dominio verificado)
EMAIL_FROM=noreply@tudominio.com
# O si usas el de prueba:
EMAIL_FROM=onboarding@resend.dev

# URL del frontend (para enlaces en emails)
FRONTEND_URL=https://your-frontend.vercel.app

# Secret para proteger el cron endpoint (OPCIONAL pero recomendado)
CRON_SECRET=tu_secreto_aleatorio_aqui_123456
```

**Nota sobre CRON_SECRET**: 
- Puedes generar uno con: `openssl rand -hex 32`
- O usar cualquier string aleatorio seguro
- Esto previene que otros ejecuten tu cron job

### 5. Ejecutar Migración SQL en Supabase

Ve a tu dashboard de Supabase → **SQL Editor** y ejecuta:

```sql
BEGIN;

-- Agregar columnas para tracking de recordatorios
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS email_reminder BOOLEAN DEFAULT TRUE;

-- Índice para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_tasks_reminder_pending 
    ON tasks(date, time, reminder_sent) 
    WHERE reminder_sent = FALSE AND email_reminder = TRUE AND date IS NOT NULL;

-- Asegurar que users tiene columna email
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

COMMIT;
```

### 6. Hacer Deploy

```bash
cd /Users/alejandrorollano/Calendario
git add -A
git commit -m "feat: Agregar sistema de recordatorios por email"
git push
```

Vercel automáticamente:
- Redesplegará el backend
- Activará el cron job (se ejecuta cada minuto)
- Los cron jobs pueden tardar hasta 5 minutos en activarse la primera vez

---

## 🧪 Probar el Sistema

### Paso 1: Verificar que el Email Service está configurado

Usando curl o Postman:

```bash
curl -X POST https://calendario-backend-one.vercel.app/api/cron/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "tu-email@ejemplo.com"}'
```

Deberías recibir un email de prueba.

### Paso 2: Crear una Tarea de Prueba

1. Entra a tu aplicación
2. Crea una tarea para dentro de **61 minutos** desde ahora
3. Asegúrate de poner:
   - ✅ Fecha
   - ✅ Hora específica
   - ✅ Título

### Paso 3: Esperar el Recordatorio

- El cron job verificará cada minuto
- Cuando falten 60 minutos, recibirás el email
- El email tiene diseño responsive y bonito

### Paso 4: Verificar Logs

Ve a Vercel → Backend → **Functions** → Clic en `/api/cron/check-reminders`

Deberías ver logs como:
```
🔔 Cron job started: checking for reminders...
Found 1 tasks needing reminders
✅ Reminder sent for task 123: "Mi Tarea" to user@example.com
🔔 Cron job completed in 234ms: 1 sent, 0 failed
```

---

## 🎨 Personalización del Email

Para personalizar el template del email, edita:
`backend/utils/emailService.js` → función `sendTaskReminder()`

El template usa HTML con estilos inline para máxima compatibilidad.

---

## 📊 Monitoreo

### Ver Cron Jobs en Vercel
1. Ve a tu proyecto backend en Vercel
2. **Cron Jobs** tab
3. Verás ejecuciones cada minuto
4. Puedes ver logs y errores

### Ver Emails Enviados en Resend
1. Ve a tu dashboard de Resend
2. **Emails** → Verás lista de todos los enviados
3. Puedes ver estado: delivered, bounced, etc.

### Ver en Base de Datos
```sql
-- Ver tareas con recordatorio enviado
SELECT title, date, time, reminder_sent, reminder_sent_at
FROM tasks
WHERE reminder_sent = TRUE
ORDER BY reminder_sent_at DESC;
```

---

## ⚙️ Características del Sistema

### ✅ Lo que hace:
- ✅ Envía email **60 minutos antes** de la hora programada
- ✅ Solo envía si la tarea tiene fecha + hora
- ✅ Solo envía una vez (no duplica)
- ✅ Email con diseño profesional y responsive
- ✅ Incluye título, descripción, fecha y hora
- ✅ Link directo a tu calendario
- ✅ Se ejecuta automáticamente cada minuto
- ✅ Gratis hasta 3,000 emails/mes

### ⚠️ Limitaciones:
- Solo para usuarios con email en su perfil
- Solo para tareas con fecha Y hora específicas
- No funciona para tareas "sin fecha"
- El cron de Vercel puede tener delay de 1-2 minutos

### 🔧 Configuraciones por Tarea:
- Por defecto: todos los recordatorios activados
- Para desactivar: en futuras versiones se puede agregar checkbox

---

## 🐛 Solución de Problemas

### Problema: No llegan emails

**Verificar:**
1. ✅ Variable `RESEND_API_KEY` configurada correctamente
2. ✅ Email del usuario existe en la tabla `users`
3. ✅ Tarea tiene fecha Y hora (no NULL)
4. ✅ Campo `email_reminder` = TRUE en la tarea
5. ✅ Campo `reminder_sent` = FALSE en la tarea
6. ✅ Revisa logs del cron job en Vercel

**Verificar dominio:**
```bash
# Si usas dominio personalizado, verifica DNS:
dig TXT midominio.com
dig TXT dkim._domainkey.midominio.com
```

### Problema: Cron job no se ejecuta

1. Ve a Vercel → Settings → Crons
2. Debe aparecer tu cron job
3. Si no aparece, espera 5-10 minutos después del deploy
4. Si sigue sin aparecer, contacta soporte de Vercel

### Problema: Emails van a spam

**Soluciones:**
1. Usa dominio propio verificado (no `@resend.dev`)
2. Configura SPF, DKIM y DMARC correctamente
3. Mantén baja tasa de rebotes
4. Pide a usuarios agregar email a contactos

---

## 💰 Costos

### Resend (Email)
- **Gratis**: 3,000 emails/mes, 100 emails/día
- **Pro**: $20/mes por 50,000 emails
- Para tu app: gratis es más que suficiente

### Vercel (Cron Jobs)
- **Hobby (gratis)**: 1 cron job, frecuencia mínima 1 minuto ✅
- **Pro**: $20/mes por ilimitados
- Para tu app: hobby es suficiente

**Total: $0/mes** para comenzar 🎉

---

## 📈 Próximas Mejoras

Ideas para el futuro:
- [ ] Checkbox en UI para activar/desactivar recordatorio por tarea
- [ ] Elegir minutos antes del recordatorio (30, 60, 120)
- [ ] Recordatorios múltiples por tarea
- [ ] Enviar resumen diario de tareas
- [ ] Notificaciones push en navegador
- [ ] SMS/WhatsApp reminders (usando Twilio)
- [ ] Recordatorios recurrentes

---

## 🆘 Soporte

Si tienes problemas:
1. Revisa los logs en Vercel
2. Revisa emails en dashboard de Resend
3. Verifica la configuración de variables de entorno
4. Ejecuta el test endpoint primero

**¡Ya está todo listo para enviar recordatorios! 📧🎉**
