# AGENTS.md — Guía de Colaboración entre Agentes · Calendar10

> **Para:** Antigravity (IDE agent) · Codex (VSCode agent)  
> **Proyecto:** Calendar10 — `/Users/alejandrorollano/Calendario`  
> **Última actualización:** 2026-03-08

---

## 🗺️ Estado actual del proyecto

Calendar10 es un calendario digital personal con sincronización en la nube. El usuario lo usa principalmente desde **mobile**; el diseño desktop está pulido, pero la experiencia móvil necesita mejoras y próximamente se añadirá colaboración grupal.

### Stack
| Capa | Tecnología |
|------|-----------|
| Frontend | Svelte + TypeScript (Vite) |
| Backend | Node.js + Express (Supabase Postgres) |
| Auth | GitHub OAuth (JWT) |
| Deploy | Vercel (frontend + backend separados) |
| Tests | Jest (unitarios) · Playwright (e2e) |

### Estructura de directorios clave
```
/src
  App.svelte               # Root: routing de vistas, OAuth callback
  types.ts                 # Tipos compartidos (Task, UserSession, AppState…)
  views/
    Calendar.svelte        # Vista mensual
    Agenda.svelte          # Lista de tareas sin fecha / por fecha
    Weekly.svelte          # Vista semanal
  components/
    Header.svelte          # Nav desktop + login + theme toggle
    BottomNav.svelte       # Nav mobile (Calendar / Agenda / Weekly)
    FAB.svelte             # Botón flotante "+" para nueva tarea
    TaskModal.svelte       # Modal crear/editar tarea (título, fecha, hora, prioridad, tags, recurrencia)
    DayModal.svelte        # Modal de detalle de día
    PdfExportModal.svelte  # Exportar a PDF
    TaskCard.svelte        # Tarjeta de tarea reutilizable
  assets/css/
    styles.css             # Estilos globales y variables CSS
    mobile-improvements.css # Mejoras UX móvil existentes
    dark-mode.css          # Tema oscuro
    header-footer-minimal.css
    agenda-professional.css
    calendar-navigation.css
    design-polish.css
  services/api.ts          # Llamadas al backend + loadTasksIntoState
  store/state.ts           # Svelte store global (tareas, sesión, filtros)
  utils/                   # helpers, UIFeedback (toasts), etc.
  actions/
    swipe.ts               # Soporte de gestos swipe
    clickOutside.ts

/backend
  server.js                # Express app
  routes/
    auth-supabase.js       # GitHub OAuth
    tasks-supabase.js      # CRUD tareas
    cron.js                # Jobs periódicos
  migrations/              # SQL migrations de Supabase
```

---

## 🎯 Hoja de ruta de mejoras — Fases

### FASE 1 — UX/UI Mobile (Prioridad ALTA 🔴)
> El diseño desktop está bien. Toda la energía va al móvil.

#### Problemas identificados en mobile
| Área | Problema |
|------|---------|
| `TaskModal.svelte` | El modal ocupa casi toda la pantalla pero no usa `position: fixed` nativo del teclado; cuando el teclado se abre, los campos quedan tapados |
| `Header.svelte` | En mobile el header muestra logo + nav + botones; demasiado denso, difícil de pulsar |
| `BottomNav.svelte` | Existe pero el área de tap es pequeña y no hay feedback háptico/visual fuerte |
| `FAB.svelte` | El FAB puede quedar encima del BottomNav en móviles pequeños |
| `Calendar.svelte` | Las celdas del calendario mensual son pequeñas en pantallas <375px |
| `DayModal.svelte` | Lista de tareas del día no tiene scroll propio; puede salir de pantalla |
| `Agenda.svelte` | Filtros y cabecera consumen mucho espacio vertical en mobile |
| `Weekly.svelte` | Columnas demasiado angostas en mobile |

#### Tareas FASE 1

**Antigravity (este agente):**
- [x] F1-A1: Rediseñar `BottomNav.svelte` — min-height 56px, pill background activo (`color-mix`), haptic feedback `navigator.vibrate(8)`, press scale animation
- [x] F1-A2: CSS custom prop `--bottom-nav-clearance` para que FAB siempre flote encima del BottomNav + safe-area
- [x] F1-A3: `TaskModal.svelte` como bottom-sheet: `visualViewport` listener para keyboard en iOS/Android, drag-to-dismiss (swipe down >80px), handle visual de arrastre
- [x] F1-A4: `Calendar.svelte` — priority dots (rojo/amarillo/azul) en celdas de mobile; `task-preview-list` oculta en mobile, sustituida por dots
- [x] F1-A5: `mobile-improvements.css` — BottomNav 72px isla flotante, FAB usa `--bottom-nav-clearance`, modal backdrop sin `pointer-events:none` (tap-to-close funciona), `.modal-content::before` fake handle eliminado, dark mode drag handle en CSS global

**Codex (agente VSCode):**
- [x] F1-C1: Revisar y mejorar `DayModal.svelte` — scroll interno, layout de lista de tareas en mobile
- [x] F1-C2: Refactorizar `Weekly.svelte` — en mobile mostrar 3 días a la vez con swipe horizontal (usar `swipe.ts`)
- [x] F1-C3: Simplificar `Header.svelte` en mobile — ocultar nav del header en <768px (ya existe BottomNav), mostrar solo logo y acciones
- [x] F1-C4: Mejorar `Agenda.svelte` — filtros colapsables, sticky header, mejores cards en mobile
- [x] F1-C5: Revisar `__tests__/` y `tests/` — añadir pruebas Playwright para flujos mobile principales

---

### FASE 2 — Calendario Grupal (Prioridad MEDIA 🟡)
> Añadir la posibilidad de crear grupos/equipos, compartir calendarios y asignarse tareas entre miembros.

#### Arquitectura propuesta: Grupos & Colaboración

```
Grupo (group)
  ├── Tiene múltiples miembros (group_members) con roles: owner | admin | member
  └── Tiene múltiples tareas grupales (group_tasks) que extienden Task
        ├── assigned_to: user_id
        ├── created_by: user_id
        └── status: todo | in_progress | done | blocked
```

#### Nuevas tablas en Supabase (migrations a crear)
```sql
-- groups
CREATE TABLE groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- group_members
CREATE TABLE group_members (
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',  -- 'owner' | 'admin' | 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- group_tasks (extiende tasks)
ALTER TABLE tasks
  ADD COLUMN group_id INTEGER REFERENCES groups(id),
  ADD COLUMN assigned_to INTEGER REFERENCES users(id),
  ADD COLUMN task_status TEXT DEFAULT 'todo';  -- 'todo'|'in_progress'|'done'|'blocked'
```

#### Nuevas vistas/componentes frontend a crear

| Archivo | Descripción |
|---------|-------------|
| `src/views/Groups.svelte` | Lista de grupos del usuario + botón crear grupo |
| `src/components/GroupModal.svelte` | Modal crear/editar grupo + invitar miembros |
| `src/components/GroupTaskCard.svelte` | Tarjeta con asignado, estado, avatar |
| `src/views/GroupCalendar.svelte` | Vista de calendario filtrada por grupo |

#### Tareas FASE 2

**Antigravity:**
- [ ] F2-A1: Crear migrations SQL para `groups`, `group_members`, y alter `tasks`
- [ ] F2-A2: Crear rutas backend `routes/groups.js` (CRUD grupos, invite, memberships)
- [ ] F2-A3: Extender `types.ts` con `Group`, `GroupMember`, `GroupTask`
- [ ] F2-A4: Crear `src/views/Groups.svelte` — pantalla de gestión de grupos
- [ ] F2-A5: Añadir "Grupos" a `BottomNav` y `Header` (4ª sección)

**Codex:**
- [x] F2-C1: Crear `src/components/GroupModal.svelte` — formulario crear grupo + búsqueda/invite de miembros
- [x] F2-C2: Extender `TaskModal.svelte` — añadir selector de grupo y campo `assigned_to`
- [x] F2-C3: Crear `src/components/GroupTaskCard.svelte` con badge de estado
- [x] F2-C4: Crear `src/views/GroupCalendar.svelte`
- [x] F2-C5: Actualizar `store/state.ts` — añadir `groups`, `activeGroupId` al `AppState`

---

## 🤝 Protocolo de coordinación entre agentes

### Convenciones de commits
```
[F1-A1] feat: rediseñar BottomNav para mobile
[F1-C3] fix: ocultar Header nav en mobile
[F2-A1] db: migration groups y group_members
```
Prefijo: `[FASE-AGENTE-NÚMERO]`

### Reglas de trabajo
1. **No tocar el mismo archivo en paralelo.** Si necesitas editar un archivo que el otro agente está tocando, indica en este AGENTS.md con `🔒 En progreso por [agente]`.
2. **No romper el build.** Siempre verificar con `npm run dev` (frontend) y `node server.js` (backend) antes de terminar.
3. **Actualizar este archivo** al completar tareas: cambiar `[ ]` por `[x]`.
4. **CSS:** Agregar estilos mobile en `mobile-improvements.css`. No crear nuevos archivos CSS sin consenso.
5. **Types:** Toda interface nueva va en `types.ts`. No crear tipos inline en componentes.
6. **Backend routes:** Siguiendo el patrón de `tasks-supabase.js` (autenticación middleware, Supabase client, manejo de errores).

### Archivos de propiedad por agente (guía, no estricto)
| Antigravity | Codex |
|-------------|-------|
| `App.svelte` | `DayModal.svelte` |
| `BottomNav.svelte` | `Weekly.svelte` |
| `FAB.svelte` | `Agenda.svelte` |
| `Calendar.svelte` | `Header.svelte` (mobile) |
| `TaskModal.svelte` (estructura) | `TaskModal.svelte` (estilos mobile) |
| Backend routes | Tests Playwright |
| SQL Migrations | `store/state.ts` (grupos) |

---

## ✅ Log de cambios completados

<!-- Los agentes registran aquí lo que completaron -->
| Fecha | Agente | Tarea | Descripción |
|-------|--------|-------|-------------|
| 2026-03-08 | Antigravity | Setup | Creación de AGENTS.md con revisión completa del proyecto |
| 2026-03-08 | Antigravity | F1-A1 | BottomNav: pill activo, tap 56px, haptic, scale press |
| 2026-03-08 | Antigravity | F1-A2 | FAB: `--bottom-nav-clearance` CSS custom prop, z-index 1001 |
| 2026-03-08 | Antigravity | F1-A3 | TaskModal: visualViewport keyboard, drag-to-dismiss handle |
| 2026-03-08 | Antigravity | F1-A4 | Calendar: priority dots (rojo/amarillo/azul) en mobile |
| 2026-03-08 | Antigravity | F1-A5 | mobile-improvements.css: BottomNav 72px, modal backdrop fix, dark handle |
| 2026-03-08 | Codex | F1-C1 | `DayModal.svelte`: scroll interno en lista de tareas y layout de modal mobile para evitar desbordes |
| 2026-03-08 | Codex | F1-C2 | `Weekly.svelte`: vista mobile de 3 días con swipe horizontal progresivo y navegación semanal intacta |
| 2026-03-08 | Codex | F1-C3 | Header mobile simplificado: se prioriza logo + acciones, ocultando texto denso de usuario en `<768px` |
| 2026-03-08 | Codex | F1-C4 | `Agenda.svelte`: filtros colapsables en mobile, toolbar sticky optimizado y disposición mobile más limpia |
| 2026-03-08 | Codex | F1-C5 | Playwright mobile: nuevos flujos para swipe semanal, filtros colapsables en Agenda y scroll interno de DayModal |
| 2026-03-09 | Codex | F2-C1 | Nuevo `GroupModal.svelte` reutilizable e integración en `Groups.svelte` para crear/unirse a grupos |
| 2026-03-09 | Codex | F2-C2 | `TaskModal.svelte`: selector de grupo + asignación de miembro (`assigned_to`) con carga dinámica de miembros |
| 2026-03-09 | Codex | F2-C3 | `GroupTaskCard.svelte` integrado en kanban de `Groups.svelte` con badge de estado y cambio de estado por evento |
| 2026-03-09 | Codex | F2-C4 | Nueva vista `GroupCalendar.svelte` para calendario mensual filtrado por grupo con carga desde API |
| 2026-03-09 | Codex | F2-C5 | `AppState` actualizado con `groups` y `activeGroupId` vía stores en `state.ts` + tipos en `types.ts` |
| 2026-03-09 | Codex | F2-C4+ | Integración de `GroupCalendar` en `Groups.svelte` mediante switch interno Kanban/Calendario |
| 2026-03-09 | Codex | QA-F2 | Nuevo e2e `groups.view-switch.spec.js` validando switch Kanban/Calendario con mocks de API |
| 2026-03-09 | Codex | QA-F2+ | Ejecución completa de `tests/e2e` con resultado 18/18 OK tras integración de vistas y modales de grupos |

---

## 🔧 Comandos útiles

```bash
# Frontend (desde raíz)
npm run dev          # Dev server http://localhost:5173
npm run build        # Build producción

# Backend
cd backend && node server.js   # Puerto 3000 (ver .env)
cd backend && node run-migrations.js  # Correr migrations

# Tests
npm test             # Jest unitarios
npx playwright test  # E2E tests
```

---

## 📌 Notas importantes

- **No commitear `.env` ni `.env.local`** — ya están en `.gitignore`
- **Supabase:** Las credenciales están en `backend/.env`. Para grupos se necesita habilitar RLS en las nuevas tablas.
- **GitHub OAuth:** El `GITHUB_CLIENT_ID` está hardcodeado en `App.svelte` línea 22 — considerar moverlo a variable de entorno en FASE 2.
- **Vercel:** Frontend y backend se despliegan por separado. Ver `vercel.json` en cada directorio.
- **Safe Areas iOS:** Usar `env(safe-area-inset-bottom)` para elementos fijos. Ya hay uso en algunos estilos pero no es consistente.
