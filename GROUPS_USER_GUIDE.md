# Sistema de Calendarios Grupales - Guía de Usuario

## 📋 Descripción

El sistema de calendarios grupales permite a los usuarios crear calendarios compartidos donde varios miembros pueden colaborar creando y gestionando tareas juntos.

## ✨ Características Principales

### 1. Calendarios Personales y Grupales
- **Calendario Personal**: Tu calendario privado predeterminado
- **Calendarios Grupales**: Calendarios compartidos con otros usuarios

### 2. Gestión de Grupos
- **Crear Grupos**: Crea calendarios grupales con nombre y descripción
- **Invitar Miembros**: Invita a otros usuarios por su username de GitHub
- **Roles**: 
  - **Admin**: Creador del grupo con permisos completos
  - **Miembro**: Usuario invitado con acceso a tareas del grupo

### 3. Sistema de Invitaciones
- Recibe invitaciones cuando alguien te agrega a un grupo
- Badge de notificación muestra el número de invitaciones pendientes
- Acepta o rechaza invitaciones según prefieras

## 🎨 Interfaz de Usuario

### Selector de Calendario (Header)
- **Dropdown**: Cambia entre tu calendario personal y calendarios grupales
- **Botón de Configuración** (⚙️): Abre el gestor de grupos

### Badge de Invitaciones (Header)
- **Icono de Sobre** (✉️): Muestra invitaciones pendientes
- **Contador Rojo**: Número de invitaciones sin responder

## 🚀 Cómo Usar

### Crear un Calendario Grupal

1. Inicia sesión con tu cuenta de GitHub
2. Haz clic en el botón de **Configuración** (⚙️) en el header
3. Haz clic en **➕ Crear Nuevo Grupo**
4. Completa el formulario:
   - **Nombre**: Título del calendario grupal
   - **Descripción** (opcional): Propósito del grupo
5. Haz clic en **Crear Grupo**

### Invitar Miembros

1. En el gestor de grupos, encuentra tu grupo
2. Haz clic en **✉️ Invitar**
3. Ingresa el **username de GitHub** del usuario
4. Haz clic en **Enviar Invitación**

### Aceptar Invitaciones

1. Cuando tengas invitaciones pendientes, verás el badge ✉️ con un contador
2. Haz clic en el badge para ver las invitaciones
3. Para cada invitación:
   - **✓ Aceptar**: Te unes al grupo
   - **✗ Rechazar**: Rechazas la invitación

### Cambiar entre Calendarios

1. Usa el **dropdown selector** en el header
2. Selecciona:
   - **📅 Mi Calendario**: Tu calendario personal
   - **👥 [Nombre del Grupo]**: Cualquier calendario grupal

### Crear Tareas en Grupos

1. **Cambia al calendario grupal** usando el selector
2. Crea tareas normalmente (modal o botón agregar)
3. Las tareas se guardarán automáticamente en el calendario grupal seleccionado
4. Todos los miembros del grupo verán las tareas

### Ver Detalles de un Grupo

1. En el gestor de grupos, haz clic en **Ver Detalles**
2. Verás:
   - Información del grupo (nombre, descripción, creador)
   - Lista de miembros con sus roles
   - Avatares de GitHub de los miembros

### Eliminar Miembros (Solo Admin)

1. Abre los **Detalles del Grupo**
2. Encuentra el miembro que quieres eliminar
3. Haz clic en **Eliminar** junto a su nombre
4. Confirma la acción

### Salir de un Grupo

1. En el gestor de grupos, encuentra el grupo del que quieres salir
2. Haz clic en **Salir**
3. Confirma que deseas abandonar el grupo
4. Ya no tendrás acceso a las tareas de ese grupo

### Eliminar un Grupo (Solo Admin)

1. En el gestor de grupos, encuentra tu grupo
2. Haz clic en **Eliminar**
3. Confirma la eliminación
   - ⚠️ **ADVERTENCIA**: Esta acción eliminará todas las tareas del grupo permanentemente

## 🎯 Casos de Uso

### Proyecto de Equipo
1. Crea un grupo llamado "Proyecto Final"
2. Invita a tus compañeros de equipo
3. Todos pueden crear y completar tareas del proyecto
4. Cada miembro ve el progreso en tiempo real

### Calendario Familiar
1. Crea un grupo "Familia"
2. Invita a miembros de tu familia
3. Coordinen eventos, tareas del hogar, etc.
4. Todos están sincronizados

### Grupo de Estudio
1. Crea un grupo "Estudio de Matemáticas"
2. Invita a compañeros de clase
3. Agreguen fechas de exámenes, tareas, sesiones de estudio
4. Colaboren en la preparación académica

## 🔒 Seguridad y Privacidad

### Políticas de Acceso
- **Tareas Personales**: Solo tú puedes verlas y editarlas
- **Tareas Grupales**: Todos los miembros del grupo tienen acceso completo
- **Grupos**: Solo miembros pueden ver tareas del grupo
- **Invitaciones**: Solo el admin puede invitar nuevos miembros

### Row Level Security (RLS)
El sistema usa políticas RLS de Supabase para garantizar que:
- Solo puedes ver grupos donde eres miembro
- Solo puedes ver tareas de grupos donde participas
- Solo el admin puede eliminar el grupo
- Solo el admin puede remover miembros

## 📱 Responsive Design

El sistema de grupos está completamente optimizado para móviles:
- **Selector**: Se adapta al tamaño de pantalla
- **Modales**: Ocupan 95% del ancho en móviles
- **Botones**: Se apilan verticalmente en pantallas pequeñas
- **Cards**: Se ajustan al ancho disponible

## 🌙 Modo Oscuro

Todos los componentes del sistema de grupos soportan modo oscuro:
- Selector de calendario con colores oscuros
- Modales con fondo oscuro
- Cards y botones adaptados
- Texto con colores de alto contraste

## 🔧 Solución de Problemas

### No veo el selector de calendario
- ✅ Asegúrate de estar **logueado con GitHub**
- El selector solo aparece para usuarios autenticados

### No puedo invitar a alguien
- ✅ Verifica que seas **admin del grupo**
- ✅ Verifica que el username de GitHub sea correcto
- ✅ El usuario debe iniciar sesión para ver la invitación

### Las tareas no aparecen en el grupo
- ✅ Asegúrate de haber **seleccionado el calendario grupal** en el dropdown
- ✅ Verifica tu conexión a internet
- ✅ Recarga la página

### No veo las invitaciones
- ✅ Cierra sesión y vuelve a iniciar sesión
- ✅ Verifica que la invitación haya sido enviada correctamente
- ✅ Contacta al admin del grupo para confirmar

## 🎨 Personalización

Los colores y estilos se pueden personalizar en:
- `groups.css`: Estilos de todos los componentes
- Variables CSS para modo oscuro en `dark-mode.css`

## 🐛 Reportar Problemas

Si encuentras algún problema:
1. Verifica la consola del navegador (F12)
2. Busca mensajes con prefijo `[GROUPS]`
3. Reporta el error con los logs correspondientes
4. Incluye pasos para reproducir el problema

## 📞 Soporte

Para más ayuda:
- 📧 Email: skillparty@outlook.com
- 📱 Teléfono: +591 60344144
- 🐙 GitHub: https://github.com/skillparty

---

**¡Disfruta colaborando con Calendar10! 🎉**
