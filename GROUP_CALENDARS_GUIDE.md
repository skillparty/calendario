# 👥 Calendarios Grupales - Guía Completa

## 🎯 Resumen

Tu aplicación ahora soporta calendarios compartidos donde múltiples usuarios pueden colaborar. Cada usuario puede:
- ✅ Crear calendarios grupales con título y descripción
- ✅ Invitar miembros usando su username de GitHub
- ✅ Ver y gestionar sus grupos
- ✅ Crear tareas en calendarios grupales
- ✅ Cambiar entre calendario personal y grupales

---

## 📋 Configuración del Backend

### Paso 1: Ejecutar Migración en Supabase

Ve a tu dashboard de Supabase → SQL Editor y ejecuta el archivo:
`backend/migrations/008_add_group_calendars.sql`

Esta migración crea:
- ✅ Tabla `groups` para los calendarios compartidos
- ✅ Tabla `group_members` para los miembros de cada grupo
- ✅ Tabla `group_invitations` para gestionar invitaciones
- ✅ Columna `group_id` en tabla `tasks`
- ✅ Índices para búsquedas eficientes
- ✅ Políticas RLS para seguridad

### Paso 2: Hacer Deploy del Backend

```bash
cd /Users/alejandrorollano/Calendario
git add -A
git commit -m "feat: Add group calendars support"
git push
```

Vercel redespl egará automáticamente.

---

## 🎨 Implementación del Frontend

### Estructura Recomendada

```
components/
  GroupManager.js       # UI principal de gestión de grupos
  GroupSelector.js      # Selector de calendario (personal/grupal)
  InvitationBadge.js    # Badge de invitaciones pendientes
  GroupModal.js         # Modal para crear/editar grupos
  InviteModal.js        # Modal para invitar miembros
```

### Flujo de Usuario

#### 1. Selector de Calendario

Agregar un dropdown en el header para cambiar entre calendarios:

```javascript
// En app.js o donde esté el header
import { fetchUserGroups } from './groups-api.js';

let currentCalendar = { type: 'personal', id: null };
const groupsCache = [];

async function loadUserGroups() {
  try {
    const groups = await fetchUserGroups();
    groupsCache.push(...groups);
    renderGroupSelector();
  } catch (error) {
    console.error('Failed to load groups:', error);
  }
}

function renderGroupSelector() {
  const container = document.getElementById('calendar-selector');
  
  const options = [
    { label: '📅 Mi Calendario', value: 'personal' },
    ...groupsCache.map(g => ({
      label: `👥 ${g.name}`,
      value: g.id
    }))
  ];
  
  const html = `
    <select id="calendar-select" class="calendar-selector">
      ${options.map(opt => `
        <option value="${opt.value}" ${currentCalendar.id === opt.value ? 'selected' : ''}>
          ${opt.label}
        </option>
      `).join('')}
    </select>
    <button id="manage-groups-btn" class="icon-btn" title="Gestionar Grupos">⚙️</button>
  `;
  
  container.innerHTML = html;
  
  document.getElementById('calendar-select').addEventListener('change', (e) => {
    switchCalendar(e.target.value);
  });
  
  document.getElementById('manage-groups-btn').addEventListener('click', () => {
    showGroupManager();
  });
}

function switchCalendar(calendarId) {
  if (calendarId === 'personal') {
    currentCalendar = { type: 'personal', id: null };
  } else {
    currentCalendar = { type: 'group', id: calendarId };
  }
  
  // Recargar tareas del calendario seleccionado
  loadTasksForCurrentCalendar();
  renderCalendar();
}
```

#### 2. Modal de Gestión de Grupos

```javascript
import { 
  fetchUserGroups, 
  createGroup, 
  deleteGroup,
  fetchGroupDetails,
  inviteToGroup,
  removeMember,
  leaveGroup
} from './groups-api.js';

function showGroupManager() {
  const modal = document.createElement('div');
  modal.className = 'modal groups-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>👥 Mis Calendarios Grupales</h2>
        <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
      </div>
      
      <div class="modal-body">
        <button id="create-group-btn" class="btn-primary">
          ➕ Crear Nuevo Grupo
        </button>
        
        <div id="groups-list" class="groups-list">
          <!-- Se llenará dinámicamente -->
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('create-group-btn').addEventListener('click', showCreateGroupModal);
  loadAndRenderGroups();
}

async function loadAndRenderGroups() {
  const container = document.getElementById('groups-list');
  container.innerHTML = '<p>Cargando...</p>';
  
  try {
    const groups = await fetchUserGroups();
    
    if (groups.length === 0) {
      container.innerHTML = '<p class="empty-state">No tienes grupos aún. ¡Crea uno!</p>';
      return;
    }
    
    const html = groups.map(group => `
      <div class="group-card">
        <div class="group-header">
          <h3>${group.name}</h3>
          <span class="group-role badge-${group.user_role}">${group.user_role}</span>
        </div>
        
        ${group.description ? `<p class="group-desc">${group.description}</p>` : ''}
        
        <div class="group-actions">
          <button onclick="viewGroupDetails('${group.id}')">Ver Detalles</button>
          ${group.user_role === 'admin' ? `
            <button onclick="showInviteModal('${group.id}')">Invitar</button>
            <button onclick="deleteGroupConfirm('${group.id}')" class="btn-danger">Eliminar</button>
          ` : `
            <button onclick="leaveGroupConfirm('${group.id}')">Salir</button>
          `}
        </div>
      </div>
    `).join('');
    
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = '<p class="error">Error al cargar grupos</p>';
    console.error(error);
  }
}
```

#### 3. Modal para Crear Grupo

```javascript
function showCreateGroupModal() {
  const modal = document.createElement('div');
  modal.className = 'modal create-group-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>➕ Crear Calendario Grupal</h2>
        <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
      </div>
      
      <form id="create-group-form" class="modal-body">
        <div class="form-group">
          <label for="group-name">Nombre del Grupo *</label>
          <input 
            type="text" 
            id="group-name" 
            required 
            maxlength="100"
            placeholder="Ej: Proyecto Final, Familia, Equipo de Trabajo"
          />
        </div>
        
        <div class="form-group">
          <label for="group-description">Descripción (opcional)</label>
          <textarea 
            id="group-description" 
            rows="3"
            maxlength="500"
            placeholder="¿De qué trata este calendario?"
          ></textarea>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
            Cancelar
          </button>
          <button type="submit" class="btn-primary">
            Crear Grupo
          </button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('create-group-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('group-name').value.trim();
    const description = document.getElementById('group-description').value.trim();
    
    try {
      const group = await createGroup({ name, description });
      alert(`¡Grupo "${name}" creado exitosamente!`);
      modal.remove();
      loadAndRenderGroups();
      loadUserGroups(); // Actualizar selector
    } catch (error) {
      alert('Error al crear grupo: ' + error.message);
    }
  });
}
```

#### 4. Modal para Invitar Miembros

```javascript
function showInviteModal(groupId) {
  const modal = document.createElement('div');
  modal.className = 'modal invite-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>✉️ Invitar al Grupo</h2>
        <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
      </div>
      
      <form id="invite-form" class="modal-body">
        <div class="form-group">
          <label for="github-username">Username de GitHub</label>
          <input 
            type="text" 
            id="github-username" 
            required 
            placeholder="Ej: octocat"
          />
          <small>El usuario recibirá una invitación cuando inicie sesión</small>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
            Cancelar
          </button>
          <button type="submit" class="btn-primary">
            Enviar Invitación
          </button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('invite-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('github-username').value.trim();
    
    try {
      const result = await inviteToGroup(groupId, username);
      alert(result.message || 'Invitación enviada exitosamente');
      modal.remove();
    } catch (error) {
      alert('Error al enviar invitación: ' + error.message);
    }
  });
}
```

#### 5. Badge de Invitaciones Pendientes

```javascript
// En el header, cerca del botón de usuario
async function loadPendingInvitations() {
  try {
    const invitations = await fetchPendingInvitations();
    
    if (invitations.length > 0) {
      showInvitationsBadge(invitations.length);
    }
  } catch (error) {
    console.error('Failed to load invitations:', error);
  }
}

function showInvitationsBadge(count) {
  const badge = document.createElement('div');
  badge.className = 'invitations-badge';
  badge.innerHTML = `
    <button class="invitations-btn" onclick="showInvitationsModal()">
      <span class="icon">✉️</span>
      <span class="badge-count">${count}</span>
    </button>
  `;
  
  document.querySelector('.header-right').prepend(badge);
}

async function showInvitationsModal() {
  const invitations = await fetchPendingInvitations();
  
  const modal = document.createElement('div');
  modal.className = 'modal invitations-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>✉️ Invitaciones Pendientes (${invitations.length})</h2>
        <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
      </div>
      
      <div class="modal-body">
        ${invitations.map(inv => `
          <div class="invitation-card">
            <div class="invitation-info">
              <h3>${inv.groups.name}</h3>
              <p>Invitado por ${inv.inviter.name || inv.inviter.username}</p>
              <small>${new Date(inv.invited_at).toLocaleDateString()}</small>
            </div>
            <div class="invitation-actions">
              <button onclick="acceptInvitationHandler('${inv.id}')" class="btn-primary">
                Aceptar
              </button>
              <button onclick="rejectInvitationHandler('${inv.id}')" class="btn-secondary">
                Rechazar
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

async function acceptInvitationHandler(invitationId) {
  try {
    await acceptInvitation(invitationId);
    alert('¡Te has unido al grupo!');
    location.reload(); // Recargar para actualizar la UI
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function rejectInvitationHandler(invitationId) {
  try {
    await rejectInvitation(invitationId);
    alert('Invitación rechazada');
    location.reload();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}
```

#### 6. Modificar Creación de Tareas

En `calendar.js`, actualizar `saveTaskFromModal` para incluir el group_id:

```javascript
export function saveTaskFromModal(originalDate, existingTaskId) {
  // ... código existente ...
  
  // Agregar group_id si es calendario grupal
  if (currentCalendar.type === 'group') {
    task.group_id = currentCalendar.id;
  }
  
  // ... resto del código ...
}
```

---

## 🎨 Estilos CSS Recomendados

```css
/* Selector de Calendario */
.calendar-selector {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.calendar-selector option {
  padding: 8px;
}

/* Grupos */
.groups-modal .modal-content {
  max-width: 600px;
}

.groups-list {
  margin-top: 20px;
  display: grid;
  gap: 16px;
}

.group-card {
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.group-header h3 {
  margin: 0;
  font-size: 18px;
}

.group-role {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.badge-admin {
  background: #667eea;
  color: white;
}

.badge-member {
  background: #e0e0e0;
  color: #666;
}

.group-desc {
  color: #666;
  margin: 12px 0;
  font-size: 14px;
}

.group-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.group-actions button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 14px;
}

.group-actions button:hover {
  background: #f5f5f5;
}

/* Badge de Invitaciones */
.invitations-badge {
  position: relative;
  margin-right: 16px;
}

.invitations-btn {
  position: relative;
  padding: 8px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 50%;
  cursor: pointer;
}

.invitations-btn .icon {
  font-size: 20px;
}

.badge-count {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #f44336;
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
}

/* Invitaciones */
.invitation-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 12px;
}

.invitation-info h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
}

.invitation-info p {
  margin: 4px 0;
  color: #666;
  font-size: 14px;
}

.invitation-actions {
  display: flex;
  gap: 8px;
}
```

---

## 📡 API Endpoints Disponibles

### Grupos
- `GET /api/groups` - Listar grupos del usuario
- `GET /api/groups/:id` - Detalles del grupo
- `POST /api/groups` - Crear grupo
- `PUT /api/groups/:id` - Actualizar grupo
- `DELETE /api/groups/:id` - Eliminar grupo

### Invitaciones
- `POST /api/groups/:id/invite` - Invitar usuario
- `GET /api/groups/invitations/pending` - Invitaciones pendientes
- `POST /api/groups/invitations/:id/accept` - Aceptar invitación
- `POST /api/groups/invitations/:id/reject` - Rechazar invitación

### Miembros
- `DELETE /api/groups/:groupId/members/:userId` - Eliminar miembro
- `POST /api/groups/:groupId/leave` - Salir del grupo

### Tareas
- `GET /api/tasks?group_id=:id` - Tareas del grupo
- `POST /api/tasks` con `group_id` - Crear tarea en grupo

---

## 🔐 Permisos y Roles

### Admin
- Puede invitar miembros
- Puede eliminar miembros
- Puede editar info del grupo
- Puede eliminar el grupo (solo creador)

### Member
- Puede ver tareas del grupo
- Puede crear tareas en el grupo
- Puede editar/eliminar sus propias tareas
- Puede salir del grupo

---

## 🚀 Próximos Pasos

1. **Deploy del Backend** (ya listo ✅)
2. **Ejecutar migración SQL en Supabase**
3. **Implementar UI completa** siguiendo los ejemplos
4. **Testing** de todos los flujos
5. **Notificaciones por email** de invitaciones (opcional)

---

## 💡 Ideas Futuras

- [ ] Roles personalizados (editor, viewer)
- [ ] Permisos granulares por tarea
- [ ] Chat del grupo
- [ ] Notificaciones en tiempo real (WebSockets)
- [ ] Colores personalizados por grupo
- [ ] Estadísticas del grupo
- [ ] Exportar calendario grupal

---

¡El sistema de calendarios grupales está completo y listo para usar! 🎉👥
