# Calendario Digital

Una aplicación web simple de calendario digital con recordatorios y agenda, construida con HTML, CSS y JavaScript.

## Características

- Vista de calendario mensual con navegación
- Agregar recordatorios a fechas específicas
- Lista de agenda con tareas pendientes
- Marcar tareas como completadas
- Notificaciones de navegador para recordatorios
- Autenticación con GitHub para gestión de usuarios
- Almacenamiento local de datos

## Instalación y Uso

1. Clona o descarga los archivos del proyecto
2. Abre `index.html` en un navegador web moderno
3. Para ejecutar localmente: `python3 -m http.server 8000` y visita `http://localhost:8000`

## Despliegue en GitHub Pages

1. Sube los archivos a un repositorio de GitHub
2. Ve a Settings > Pages
3. Selecciona la rama principal y carpeta raíz
4. La aplicación estará disponible en `https://tu-usuario.github.io/tu-repositorio`

## Configuración de GitHub OAuth

Para habilitar la autenticación con GitHub:

1. Ve a GitHub Settings > Developer settings > OAuth Apps
2. Crea una nueva OAuth App
3. Establece la Authorization callback URL como tu URL de GitHub Pages
4. Copia el Client ID
5. En `script.js`, reemplaza `'your-github-client-id'` con tu Client ID real

## Tecnologías Utilizadas

- HTML5
- CSS3
- JavaScript (ES6+)
- Local Storage API
- Notification API
- GitHub OAuth API

## Navegador Soportado

- Chrome/Edge: Funcionalidad completa
- Firefox: Funcionalidad completa
- Safari: Funcionalidad limitada (sin notificaciones)

## Licencia

Este proyecto es de código abierto y gratuito para uso personal y educativo.