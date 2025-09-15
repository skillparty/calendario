# Calendario Digital

Una aplicación web simple de calendario digital con recordatorios y agenda, construida con HTML, CSS y JavaScript.

## Características

- Vista de calendario mensual con navegación
- Agregar recordatorios a fechas específicas
- Lista de agenda con tareas pendientes
- Marcar tareas como completadas
- Notificaciones de navegador para recordatorios
- Autenticación con GitHub para gestión de usuarios (Device Flow)
- Almacenamiento local de datos + sincronización opcional con GitHub Gist

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
5. En `script.js`, asegúrate de que `GITHUB_CLIENT_ID` tenga tu Client ID real

### Cómo funciona el inicio de sesión (Device Flow)

- Al hacer clic en "Iniciar Sesión", se inicia el Device Flow de GitHub.
- Se muestra un código de usuario y un botón "Abrir GitHub". Abre GitHub, pega el código y autoriza.
- La app hace polling hasta recibir el `access_token` de GitHub.
- Una vez autenticado, se obtiene tu perfil (`/user`) y se busca un Gist existente con `calendar-tasks.json`.
- Si no existe, al guardar tareas se crea/actualiza un Gist privado con tus datos para sincronización entre dispositivos.

Notas:
- Este flujo funciona 100% en cliente (GitHub Pages), sin backend.
- Si GitHub cambia el comportamiento del flujo implícito, hay un fallback que redirige a la página clásica de autorización.

### Almacenamiento de datos

- Localmente: `localStorage` bajo la clave `calendarTasks`.
- En la nube (opcional): Gist privado llamado `calendar-tasks.json` en tu cuenta de GitHub.
- La app intenta detectar un Gist existente al iniciar sesión, para que tus datos viajen contigo.

### Sobre errores 404 de *.scss.map

Si ves en la consola 404 como `light_high_contrast.scss.map`, `index.scss.map` o `dark_dimmed.scss.map` al abrir la ventana de autorización de GitHub: son archivos de sourcemap del propio sitio de GitHub. No afectan a tu aplicación ni a la autenticación; son inofensivos y puedes ignorarlos.

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