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

## Arquitectura de módulos (ESM)

La app ahora está dividida en módulos ES para mejorar legibilidad y mantenibilidad:

- `state.js`: Estado centralizado (tareas, sesión de usuario, filtros, sincronización).
- `api.js`: Cliente de API (JWT), paginación (`fetchAllTasksFromBackend`), carga y reconciliación con el backend.
- `calendar.js`: Render del calendario, modal de día, creación/edición de tareas, validación de fechas pasadas.
- `agenda.js`: Lista de tareas sin fecha, filtros por mes/estado, acciones rápidas y sidebar.
- `pdf.js`: Exportación a PDF y modal de opciones, integración con jsPDF.
- `app.js`: Punto de entrada. Orquesta autenticación, vistas, notificaciones y sincronización.

Nota: El archivo legacy `script.js` fue reemplazado por estos módulos y ya no se utiliza.

## TypeScript (migración gradual)

Esta app usa una migración gradual a TypeScript basada en JSDoc, sin build adicional ni cambios en tiempo de ejecución.

- Tipos compartidos en `types.d.ts`:
  - `Task`, `CalendarTask`, `AgendaTask`, `APITask`, `TasksByDate`, `UserSession`, `AppState`.
- Archivos con tipado JSDoc:
  - `state.js`, `api.js`, `calendar.js`, `agenda.js`, `pdf.js`, `app.js`.
- Configuración en `tsconfig.json`:
  - `allowJs: true`, `checkJs: true`, `noEmit: true`.

Ejecutar chequeo de tipos (no compila ni genera archivos):

```bash
npx tsc -p tsconfig.json
# o usando npm script
npm run typecheck
```

Ejemplo de JSDoc para tipos:

```js
/** @typedef {import('./types').Task} Task */

/** @param {Task[]} tasks */
function renderList(tasks) { /* ... */ }
```

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
5. En `app.js`, asegúrate de que `GITHUB_CLIENT_ID` tenga tu Client ID real. Si usas un backend propio, ajusta `API_BASE_URL` en `api.js`. La constante `OAUTH_PROXY_URL` en `app.js` apunta por defecto a `${API_BASE_URL}/api/auth/github`.

### Cómo funciona el inicio de sesión (Device Flow)

- Al hacer clic en "Iniciar Sesión", se inicia el Device Flow de GitHub.
- Se muestra un código de usuario y un botón "Abrir GitHub". Abre GitHub, pega el código y autoriza.
- La app hace polling hasta recibir el `access_token` de GitHub.
- Una vez autenticado, se obtiene tu perfil (`/user`) y se busca un Gist existente con `calendar-tasks.json`.
- Si no existe, al guardar tareas se crea/actualiza un Gist privado con tus datos para sincronización entre dispositivos.

Notas:
- Este flujo funciona 100% en cliente (GitHub Pages), sin backend.
- Si GitHub cambia el comportamiento del flujo implícito, hay un fallback que redirige a la página clásica de autorización.

### Opción alternativa: Authorization Code Flow (con proxy)

Si deseas usar el flujo estándar (Authorization Code) para obtener el token directamente:

1. Despliega un endpoint (Cloudflare Worker / Vercel / Netlify Function) que reciba `{ code, redirect_uri }` y llame a `https://github.com/login/oauth/access_token` con `client_id` y `client_secret`.
2. Responde JSON: `{ access_token: "..." }`.
3. Asegúrate de que `API_BASE_URL` en `api.js` apunte a tu backend. En `app.js`, `OAUTH_PROXY_URL` por defecto usa `${API_BASE_URL}/api/auth/github`. Si tu proxy usa otra ruta, cambia `OAUTH_PROXY_URL` en `app.js`.
4. Entonces, cuando GitHub redirija con `?code=...`, la app hará el intercambio automáticamente.

Ejemplo (pseudo Worker):
```js
export default async (req) => {
	const { code, redirect_uri } = await req.json();
	const r = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: { 'Accept': 'application/json' },
		body: new URLSearchParams({
			client_id: GITHUB_CLIENT_ID,
			client_secret: GITHUB_CLIENT_SECRET,
			code,
			redirect_uri
		})
	});
	return new Response(r.body, { headers: { 'Content-Type': 'application/json' } });
}
```

Importante: Nunca expongas el `client_secret` en el frontend. Por eso se usa un proxy.

### Solución de problemas de login

- Veo un código `?code=` pero nunca se completa el login: Configura `OAUTH_PROXY_URL` o usa el Device Flow (botón inicial) y sigue los pasos.
- El modal de Device Flow se queda en “Esperando autorización…”: Asegúrate de abrir la URL y pegar el código exacto; revisa consola por errores de red.
- 404 en sourcemaps o CSP warnings: Son de GitHub; ignóralos si el flujo continúa.
- Token invalido luego de obtenerlo: Revoca la App en GitHub Settings > Applications y vuelve a autorizar.

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