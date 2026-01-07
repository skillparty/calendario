// Group Management UI Component
// Handles groups CRUD, invitations, and member management

import { 
  fetchUserGroups, 
  createGroup, 
  updateGroup,
  deleteGroup,
  fetchGroupDetails,
  inviteToGroup,
  removeMember,
  leaveGroup,
  fetchPendingInvitations,
  acceptInvitation,
  rejectInvitation
} from './groups-api.js';

import { isLoggedInWithBackend } from './api.js';

// Estado global de grupos
export let currentCalendar = { type: 'personal', id: null, name: 'Mi Calendario' };
export let groupsCache = [];
export let pendingInvitationsCount = 0;

// Expose currentCalendar globally for access from other modules
if (typeof window !== 'undefined') {
  window.currentCalendar = currentCalendar;
}

/**
 * Initialize groups system
 */
export async function initGroups() {
  if (!isLoggedInWithBackend()) return;
  
  try {
    await loadUserGroups();
    await checkPendingInvitations();
    renderGroupSelector();
    renderInvitationsBadge();
  } catch (error) {
    console.error('[GROUPS] Initialization failed:', error);
  }
}

/**
 * Load user's groups
 */
export async function loadUserGroups() {
  try {
    const groups = await fetchUserGroups();
    groupsCache = groups;
    console.log('[GROUPS] Loaded', groups.length, 'groups');
    return groups;
  } catch (error) {
    console.error('[GROUPS] Failed to load groups:', error);
    groupsCache = [];
    return [];
  }
}

/**
 * Check pending invitations
 */
async function checkPendingInvitations() {
  try {
    const invitations = await fetchPendingInvitations();
    pendingInvitationsCount = invitations.length;
    console.log('[GROUPS] Pending invitations:', pendingInvitationsCount);
  } catch (error) {
    console.error('[GROUPS] Failed to check invitations:', error);
    pendingInvitationsCount = 0;
  }
}

/**
 * Switch to a different calendar
 */
export function switchCalendar(calendarId, calendarName) {
  if (calendarId === 'personal') {
    currentCalendar = { type: 'personal', id: null, name: 'Mi Calendario' };
  } else {
    const group = groupsCache.find(g => g.id === calendarId);
    currentCalendar = { 
      type: 'group', 
      id: calendarId, 
      name: group ? group.name : 'Grupo'
    };
  }
  
  // Update global reference
  if (typeof window !== 'undefined') {
    window.currentCalendar = currentCalendar;
  }
  
  console.log('[GROUPS] Switched to:', currentCalendar);
  
  // Notify calendar to reload
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('calendar-changed', { 
      detail: currentCalendar 
    }));
  }
}

/**
 * Render group selector in header
 */
export function renderGroupSelector() {
  const container = document.getElementById('calendar-selector');
  if (!container) {
    console.warn('[GROUPS] Calendar selector container not found');
    return;
  }
  
  const options = [
    { label: '📅 Mi Calendario', value: 'personal' },
    ...groupsCache.map(g => ({
      label: `👥 ${g.name}`,
      value: g.id
    }))
  ];
  
  const html = `
    <select id="calendar-select" class="calendar-selector" title="Seleccionar calendario">
      ${options.map(opt => `
        <option value="${opt.value}" ${currentCalendar.id === opt.value || (currentCalendar.type === 'personal' && opt.value === 'personal') ? 'selected' : ''}>
          ${opt.label}
        </option>
      `).join('')}
    </select>
    <button id="manage-groups-btn" class="icon-btn" title="Gestionar Grupos">⚙️</button>
  `;
  
  container.innerHTML = html;
  
  const selectEl = document.getElementById('calendar-select');
  if (selectEl) {
    selectEl.addEventListener('change', (e) => {
      const selectedValue = e.target.value;
      const selectedOption = options.find(opt => opt.value === selectedValue);
      switchCalendar(selectedValue, selectedOption?.label || 'Calendario');
    });
  }
  
  const manageBtn = document.getElementById('manage-groups-btn');
  if (manageBtn) {
    manageBtn.addEventListener('click', showGroupManager);
  }
}

/**
 * Render invitations badge
 */
export function renderInvitationsBadge() {
  if (pendingInvitationsCount === 0) return;
  
  const container = document.querySelector('.header-right');
  if (!container) return;
  
  // Remove existing badge
  const existing = container.querySelector('.invitations-badge');
  if (existing) existing.remove();
  
  const badge = document.createElement('div');
  badge.className = 'invitations-badge';
  badge.innerHTML = `
    <button class="invitations-btn" title="Ver invitaciones pendientes">
      <span class="icon">✉️</span>
      <span class="badge-count">${pendingInvitationsCount}</span>
    </button>
  `;
  
  container.insertBefore(badge, container.firstChild);
  
  badge.querySelector('.invitations-btn').addEventListener('click', showInvitationsModal);
}

/**
 * Show group manager modal
 */
export async function showGroupManager() {
  const modal = document.createElement('div');
  modal.className = 'modal groups-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>👥 Mis Calendarios Grupales</h2>
        <button class="close-btn">×</button>
      </div>
      
      <div class="modal-body">
        <button id="create-group-btn" class="btn-primary">
          ➕ Crear Nuevo Grupo
        </button>
        
        <div id="groups-list" class="groups-list">
          <p>Cargando...</p>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close button
  modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  
  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  // Create group button
  document.getElementById('create-group-btn').addEventListener('click', showCreateGroupModal);
  
  // Load groups
  await loadAndRenderGroups();
}

/**
 * Load and render groups list
 */
async function loadAndRenderGroups() {
  const container = document.getElementById('groups-list');
  if (!container) return;
  
  container.innerHTML = '<p>Cargando...</p>';
  
  try {
    const groups = await fetchUserGroups();
    groupsCache = groups;
    
    if (groups.length === 0) {
      container.innerHTML = '<p class="empty-state">No tienes grupos aún. ¡Crea uno para colaborar!</p>';
      return;
    }
    
    const html = groups.map(group => `
      <div class="group-card" data-group-id="${group.id}">
        <div class="group-header">
          <h3>${escapeHtml(group.name)}</h3>
          <span class="group-role badge-${group.user_role}">${group.user_role === 'admin' ? 'Admin' : 'Miembro'}</span>
        </div>
        
        ${group.description ? `<p class="group-desc">${escapeHtml(group.description)}</p>` : ''}
        
        <div class="group-meta">
          <span>👤 Creado por ${escapeHtml(group.creator?.name || group.creator?.username || 'Usuario')}</span>
          <span>📅 ${new Date(group.created_at).toLocaleDateString('es-ES')}</span>
        </div>
        
        <div class="group-actions">
          <button class="btn-secondary view-details" data-group-id="${group.id}">
            Ver Detalles
          </button>
          ${group.user_role === 'admin' ? `
            <button class="btn-secondary invite-btn" data-group-id="${group.id}">
              ✉️ Invitar
            </button>
            <button class="btn-danger delete-btn" data-group-id="${group.id}">
              Eliminar
            </button>
          ` : `
            <button class="btn-secondary leave-btn" data-group-id="${group.id}">
              Salir
            </button>
          `}
        </div>
      </div>
    `).join('');
    
    container.innerHTML = html;
    
    // Event listeners
    container.querySelectorAll('.view-details').forEach(btn => {
      btn.addEventListener('click', () => viewGroupDetails(btn.dataset.groupId));
    });
    
    container.querySelectorAll('.invite-btn').forEach(btn => {
      btn.addEventListener('click', () => showInviteModal(btn.dataset.groupId));
    });
    
    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteGroupConfirm(btn.dataset.groupId));
    });
    
    container.querySelectorAll('.leave-btn').forEach(btn => {
      btn.addEventListener('click', () => leaveGroupConfirm(btn.dataset.groupId));
    });
    
  } catch (error) {
    container.innerHTML = '<p class="error">Error al cargar grupos. Intenta de nuevo.</p>';
    console.error('[GROUPS] Load error:', error);
  }
}

/**
 * Show create group modal
 */
function showCreateGroupModal() {
  const modal = document.createElement('div');
  modal.className = 'modal create-group-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>➕ Crear Calendario Grupal</h2>
        <button class="close-btn">×</button>
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
          <button type="button" class="btn-secondary cancel-btn">
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
  
  modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  document.getElementById('create-group-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('group-name').value.trim();
    const description = document.getElementById('group-description').value.trim();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creando...';
    
    try {
      const group = await createGroup({ name, description });
      console.log('[GROUPS] Created:', group);
      
      showNotification(`¡Grupo "${name}" creado exitosamente!`, 'success');
      modal.remove();
      
      await loadUserGroups();
      renderGroupSelector();
      
      // Recargar lista si el modal de gestión está abierto
      const groupsList = document.getElementById('groups-list');
      if (groupsList) {
        await loadAndRenderGroups();
      }
    } catch (error) {
      console.error('[GROUPS] Create error:', error);
      showNotification('Error al crear grupo: ' + error.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear Grupo';
    }
  });
}

/**
 * Show invite modal
 */
function showInviteModal(groupId) {
  const group = groupsCache.find(g => g.id === groupId);
  
  const modal = document.createElement('div');
  modal.className = 'modal invite-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>✉️ Invitar al Grupo</h2>
        <button class="close-btn">×</button>
      </div>
      
      <form id="invite-form" class="modal-body">
        <p class="info-text">
          Invitando a: <strong>${escapeHtml(group?.name || 'Grupo')}</strong>
        </p>
        
        <div class="form-group">
          <label for="github-username">Username de GitHub *</label>
          <input 
            type="text" 
            id="github-username" 
            required 
            placeholder="Ej: octocat"
            pattern="[a-zA-Z0-9-]+"
          />
          <small>El usuario recibirá una invitación cuando inicie sesión</small>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn-secondary cancel-btn">
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
  
  modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  document.getElementById('invite-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('github-username').value.trim();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    
    try {
      const result = await inviteToGroup(groupId, username);
      console.log('[GROUPS] Invitation sent:', result);
      
      showNotification(result.message || 'Invitación enviada exitosamente', 'success');
      modal.remove();
    } catch (error) {
      console.error('[GROUPS] Invite error:', error);
      showNotification('Error al enviar invitación: ' + error.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar Invitación';
    }
  });
}

/**
 * View group details
 */
async function viewGroupDetails(groupId) {
  const modal = document.createElement('div');
  modal.className = 'modal group-details-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>👥 Detalles del Grupo</h2>
        <button class="close-btn">×</button>
      </div>
      
      <div class="modal-body">
        <p>Cargando...</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  try {
    const group = await fetchGroupDetails(groupId);
    
    const body = modal.querySelector('.modal-body');
    body.innerHTML = `
      <div class="group-info">
        <h3>${escapeHtml(group.name)}</h3>
        ${group.description ? `<p>${escapeHtml(group.description)}</p>` : ''}
        <p class="meta">Creado por ${escapeHtml(group.creator?.name || group.creator?.username || 'Usuario')}</p>
      </div>
      
      <div class="members-section">
        <h4>Miembros (${group.members?.length || 0})</h4>
        <div class="members-list">
          ${(group.members || []).map(member => `
            <div class="member-card">
              ${member.users.avatar_url ? `<img src="${member.users.avatar_url}" alt="${member.users.username}" class="member-avatar">` : '<div class="member-avatar-placeholder">👤</div>'}
              <div class="member-info">
                <strong>${escapeHtml(member.users.name || member.users.username)}</strong>
                <span class="member-role">${member.role === 'admin' ? 'Admin' : 'Miembro'}</span>
              </div>
              ${group.user_role === 'admin' && member.users.id !== group.created_by ? `
                <button class="btn-sm btn-danger remove-member" data-member-id="${member.users.id}">
                  Eliminar
                </button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    // Remove member buttons
    body.querySelectorAll('.remove-member').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('¿Estás seguro de eliminar este miembro?')) {
          try {
            await removeMember(groupId, btn.dataset.memberId);
            showNotification('Miembro eliminado', 'success');
            viewGroupDetails(groupId); // Reload
          } catch (error) {
            showNotification('Error al eliminar miembro', 'error');
          }
        }
      });
    });
    
  } catch (error) {
    modal.querySelector('.modal-body').innerHTML = '<p class="error">Error al cargar detalles</p>';
    console.error('[GROUPS] Details error:', error);
  }
}

/**
 * Delete group confirmation
 */
async function deleteGroupConfirm(groupId) {
  const group = groupsCache.find(g => g.id === groupId);
  
  if (!confirm(`¿Estás seguro de eliminar el grupo "${group?.name || 'este grupo'}"?\n\nEsta acción no se puede deshacer y se eliminarán todas las tareas del grupo.`)) {
    return;
  }
  
  try {
    await deleteGroup(groupId);
    console.log('[GROUPS] Deleted:', groupId);
    
    showNotification('Grupo eliminado exitosamente', 'success');
    
    // If current calendar is this group, switch to personal
    if (currentCalendar.id === groupId) {
      switchCalendar('personal', 'Mi Calendario');
    }
    
    await loadUserGroups();
    renderGroupSelector();
    
    const groupsList = document.getElementById('groups-list');
    if (groupsList) {
      await loadAndRenderGroups();
    }
  } catch (error) {
    console.error('[GROUPS] Delete error:', error);
    showNotification('Error al eliminar grupo: ' + error.message, 'error');
  }
}

/**
 * Leave group confirmation
 */
async function leaveGroupConfirm(groupId) {
  const group = groupsCache.find(g => g.id === groupId);
  
  if (!confirm(`¿Estás seguro de salir del grupo "${group?.name || 'este grupo'}"?`)) {
    return;
  }
  
  try {
    await leaveGroup(groupId);
    console.log('[GROUPS] Left group:', groupId);
    
    showNotification('Has salido del grupo', 'success');
    
    if (currentCalendar.id === groupId) {
      switchCalendar('personal', 'Mi Calendario');
    }
    
    await loadUserGroups();
    renderGroupSelector();
    
    const groupsList = document.getElementById('groups-list');
    if (groupsList) {
      await loadAndRenderGroups();
    }
  } catch (error) {
    console.error('[GROUPS] Leave error:', error);
    showNotification('Error al salir del grupo: ' + error.message, 'error');
  }
}

/**
 * Show invitations modal
 */
export async function showInvitationsModal() {
  const modal = document.createElement('div');
  modal.className = 'modal invitations-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>✉️ Invitaciones Pendientes</h2>
        <button class="close-btn">×</button>
      </div>
      
      <div class="modal-body">
        <p>Cargando...</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  try {
    const invitations = await fetchPendingInvitations();
    
    const body = modal.querySelector('.modal-body');
    
    if (invitations.length === 0) {
      body.innerHTML = '<p class="empty-state">No tienes invitaciones pendientes</p>';
      return;
    }
    
    body.innerHTML = invitations.map(inv => `
      <div class="invitation-card">
        <div class="invitation-info">
          <h3>${escapeHtml(inv.groups.name)}</h3>
          ${inv.groups.description ? `<p>${escapeHtml(inv.groups.description)}</p>` : ''}
          <p class="meta">
            Invitado por ${escapeHtml(inv.inviter.name || inv.inviter.username)}
            • ${new Date(inv.invited_at).toLocaleDateString('es-ES')}
          </p>
        </div>
        <div class="invitation-actions">
          <button class="btn-primary accept-inv" data-inv-id="${inv.id}">
            ✓ Aceptar
          </button>
          <button class="btn-secondary reject-inv" data-inv-id="${inv.id}">
            ✗ Rechazar
          </button>
        </div>
      </div>
    `).join('');
    
    // Accept buttons
    body.querySelectorAll('.accept-inv').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Aceptando...';
        
        try {
          await acceptInvitation(btn.dataset.invId);
          showNotification('¡Te has unido al grupo!', 'success');
          modal.remove();
          
          await loadUserGroups();
          await checkPendingInvitations();
          renderGroupSelector();
          renderInvitationsBadge();
        } catch (error) {
          showNotification('Error al aceptar invitación', 'error');
          btn.disabled = false;
          btn.textContent = '✓ Aceptar';
        }
      });
    });
    
    // Reject buttons
    body.querySelectorAll('.reject-inv').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Rechazando...';
        
        try {
          await rejectInvitation(btn.dataset.invId);
          showNotification('Invitación rechazada', 'success');
          
          // Remove card
          btn.closest('.invitation-card').remove();
          
          await checkPendingInvitations();
          renderInvitationsBadge();
          
          // Close if no more invitations
          if (body.querySelectorAll('.invitation-card').length === 0) {
            modal.remove();
          }
        } catch (error) {
          showNotification('Error al rechazar invitación', 'error');
          btn.disabled = false;
          btn.textContent = '✗ Rechazar';
        }
      });
    });
    
  } catch (error) {
    modal.querySelector('.modal-body').innerHTML = '<p class="error">Error al cargar invitaciones</p>';
    console.error('[GROUPS] Invitations error:', error);
  }
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Expose functions for inline handlers if needed
if (typeof window !== 'undefined') {
  window.showGroupManager = showGroupManager;
  window.showInvitationsModal = showInvitationsModal;
}
