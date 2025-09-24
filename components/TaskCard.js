/**
 * @typedef {import('../types-enhanced').Task} Task
 * @typedef {import('../types-enhanced').Priority} Priority
 */

/**
 * Web Component for displaying a task card
 * Provides reusable, encapsulated task display
 */
export class TaskCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    /** @type {Task | null} */
    this.task = null;
  }

  static get observedAttributes() {
    return ['task-id', 'completed', 'view-mode'];
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
  }

  disconnectedCallback() {
    this.removeEventListeners();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  /**
   * Set task data
   * @param {Task} task 
   */
  setTask(task) {
    this.task = task;
    this.setAttribute('task-id', task.id);
    this.setAttribute('completed', task.completed.toString());
    this.render();
  }

  render() {
    if (!this.task && this.hasAttribute('task-id')) {
      // Try to load task from state
      this.loadTask();
    }

    if (!this.task) {
      this.shadowRoot.innerHTML = '<div class="empty">No task data</div>';
      return;
    }

    const viewMode = this.getAttribute('view-mode') || 'compact';
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          margin: 8px 0;
        }

        .task-card {
          background: var(--bg-secondary, #fff);
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 8px;
          padding: 12px;
          transition: all 0.3s ease;
          cursor: pointer;
          position: relative;
        }

        .task-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .task-card.completed {
          opacity: 0.7;
          background: var(--bg-completed, #f0f0f0);
        }

        .task-card.completed .task-title {
          text-decoration: line-through;
          color: var(--text-muted, #666);
        }

        .task-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .task-checkbox {
          width: 20px;
          height: 20px;
          border: 2px solid var(--border-color, #ccc);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .task-checkbox.checked {
          background: var(--success-color, #4caf50);
          border-color: var(--success-color, #4caf50);
        }

        .task-checkbox.checked::after {
          content: '✓';
          color: white;
          font-size: 14px;
        }

        .task-title {
          font-size: 16px;
          font-weight: 500;
          color: var(--text-primary, #333);
          flex: 1;
          word-break: break-word;
        }

        .task-priority {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .priority-1 { background: #f44336; }
        .priority-2 { background: #ff9800; }
        .priority-3 { background: #ffeb3b; }
        .priority-4 { background: #8bc34a; }
        .priority-5 { background: #4caf50; }

        .task-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          color: var(--text-secondary, #666);
          margin-top: 8px;
        }

        .task-time {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .task-date {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .task-tags {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          margin-top: 8px;
        }

        .task-tag {
          background: var(--tag-bg, #e3f2fd);
          color: var(--tag-color, #1976d2);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .task-description {
          margin-top: 8px;
          font-size: 14px;
          color: var(--text-secondary, #666);
          line-height: 1.4;
        }

        .task-actions {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          gap: 8px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .task-card:hover .task-actions {
          opacity: 1;
        }

        .action-btn {
          width: 28px;
          height: 28px;
          border: none;
          background: var(--bg-tertiary, #f5f5f5);
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .action-btn:hover {
          background: var(--bg-hover, #e0e0e0);
          transform: scale(1.1);
        }

        .empty {
          padding: 20px;
          text-align: center;
          color: var(--text-muted, #999);
        }

        /* Expanded view styles */
        :host([view-mode="expanded"]) .task-card {
          padding: 16px;
        }

        :host([view-mode="expanded"]) .task-title {
          font-size: 18px;
          margin-bottom: 4px;
        }

        /* Animations */
        @keyframes checkIn {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        .task-checkbox.animating {
          animation: checkIn 0.3s ease;
        }
      </style>

      <div class="task-card ${this.task.completed ? 'completed' : ''}" data-task-id="${this.task.id}">
        <div class="task-header">
          <div class="task-checkbox ${this.task.completed ? 'checked' : ''}" 
               role="checkbox" 
               aria-checked="${this.task.completed}"
               tabindex="0"></div>
          <div class="task-title">${this.escapeHtml(this.task.title)}</div>
          ${this.task.priority ? `<div class="task-priority priority-${this.task.priority}" title="Prioridad ${this.task.priority}"></div>` : ''}
        </div>

        ${viewMode === 'expanded' && this.task.description ? `
          <div class="task-description">${this.escapeHtml(this.task.description)}</div>
        ` : ''}

        <div class="task-meta">
          ${this.task.date ? `
            <div class="task-date">
              <span>📅</span>
              <span>${this.formatDate(this.task.date)}</span>
            </div>
          ` : ''}
          ${this.task.time ? `
            <div class="task-time">
              <span>⏰</span>
              <span>${this.task.time}</span>
            </div>
          ` : ''}
          ${this.task.isReminder ? '<span title="Recordatorio activo">🔔</span>' : ''}
        </div>

        ${this.task.tags && this.task.tags.length > 0 ? `
          <div class="task-tags">
            ${this.task.tags.map(tag => `
              <span class="task-tag">${this.escapeHtml(tag)}</span>
            `).join('')}
          </div>
        ` : ''}

        <div class="task-actions">
          <button class="action-btn edit-btn" title="Editar" aria-label="Editar tarea">
            ✏️
          </button>
          <button class="action-btn delete-btn" title="Eliminar" aria-label="Eliminar tarea">
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    const card = this.shadowRoot.querySelector('.task-card');
    const checkbox = this.shadowRoot.querySelector('.task-checkbox');
    const editBtn = this.shadowRoot.querySelector('.edit-btn');
    const deleteBtn = this.shadowRoot.querySelector('.delete-btn');

    if (checkbox) {
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleToggle();
      });

      checkbox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleToggle();
        }
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleEdit();
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleDelete();
      });
    }

    if (card) {
      card.addEventListener('click', () => {
        this.handleClick();
      });
    }
  }

  removeEventListeners() {
    // Cleanup if needed
  }

  handleToggle() {
    const checkbox = this.shadowRoot.querySelector('.task-checkbox');
    checkbox.classList.add('animating');
    
    setTimeout(() => {
      checkbox.classList.remove('animating');
    }, 300);

    this.dispatchEvent(new CustomEvent('task-toggle', {
      detail: { taskId: this.task.id, completed: !this.task.completed },
      bubbles: true,
      composed: true
    }));
  }

  handleEdit() {
    this.dispatchEvent(new CustomEvent('task-edit', {
      detail: { task: this.task },
      bubbles: true,
      composed: true
    }));
  }

  handleDelete() {
    if (confirm(`¿Eliminar "${this.task.title}"?`)) {
      this.dispatchEvent(new CustomEvent('task-delete', {
        detail: { taskId: this.task.id },
        bubbles: true,
        composed: true
      }));
    }
  }

  handleClick() {
    this.dispatchEvent(new CustomEvent('task-click', {
      detail: { task: this.task },
      bubbles: true,
      composed: true
    }));
  }

  /**
   * Load task from state manager
   * @private
   */
  loadTask() {
    // This would connect to the state manager
    // For now, we'll leave it as a placeholder
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   * @param {string} text 
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format date for display
   * @private
   * @param {string} dateStr 
   * @returns {string}
   */
  formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.getTime() === today.getTime()) {
      return 'Hoy';
    } else if (date.getTime() === tomorrow.getTime()) {
      return 'Mañana';
    } else {
      return date.toLocaleDateString('es-ES', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
      });
    }
  }
}

// Register the custom element
customElements.define('task-card', TaskCard);
