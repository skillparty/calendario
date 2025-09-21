// Global variables
let currentDate = new Date();
let tasks = JSON.parse(localStorage.getItem('calendarTasks')) || {};
let userSession = JSON.parse(localStorage.getItem('userSession')) || null;
let userGistId = localStorage.getItem('userGistId') || null;
let lastGistUpdatedAt = localStorage.getItem('lastGistUpdatedAt') || null;
let backgroundSyncTimer = null;
let baseSyncIntervalMs = 120000; // 2 minutes
let currentSyncIntervalMs = baseSyncIntervalMs;
const maxSyncIntervalMs = 600000; // 10 minutes cap

// Backend API base URL
const API_BASE_URL = 'https://calendario-backend-v2.fly.dev';

// GitHub OAuth constants
const GITHUB_CLIENT_ID = 'Ov23liyk7oqj7OI75MfO';
const GITHUB_REDIRECT_URI = 'https://skillparty.github.io/calendario';
// Deprecated implicit flow URL retained for fallback/debug; main flow uses Device Flow below
const GITHUB_AUTH_URL = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=user,gist&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}`;
const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_DEVICE_TOKEN_URL = 'https://github.com/login/oauth/access_token';
// Use backend to exchange authorization code -> JWT + user
// Expected POST JSON: { code, redirect_uri } -> returns { success, token, user }
const OAUTH_PROXY_URL = API_BASE_URL + '/api/auth/github';

// Helper: API fetch with JWT
async function apiFetch(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (userSession && userSession.jwt) {
        headers['Authorization'] = `Bearer ${userSession.jwt}`;
    }
    const init = Object.assign({}, options, { headers });
    const res = await fetch(API_BASE_URL + path, init);
    return res;
}

// DOM elements - will be initialized after DOM loads
let calendarBtn, agendaBtn, loginBtn, logoutBtn, userInfo, userAvatar, userName, calendarView, agendaView;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initializing...');
    console.log('Current URL:', window.location.href);
    console.log('URL hash:', window.location.hash);

    // Initialize DOM elements
    calendarBtn = document.getElementById('calendar-btn');
    agendaBtn = document.getElementById('agenda-btn');
    loginBtn = document.getElementById('login-btn');
    logoutBtn = document.getElementById('logout-btn');
    userInfo = document.getElementById('user-info');
    userAvatar = document.getElementById('user-avatar');
    userName = document.getElementById('user-name');
    calendarView = document.getElementById('calendar-view');
    agendaView = document.getElementById('agenda-view');

    console.log('DOM elements found:', {
        calendarBtn: !!calendarBtn,
        agendaBtn: !!agendaBtn,
        loginBtn: !!loginBtn,
        logoutBtn: !!logoutBtn,
        userInfo: !!userInfo,
        userAvatar: !!userAvatar,
        userName: !!userName
    });

    // Add event listeners
    if (calendarBtn) calendarBtn.addEventListener('click', showCalendar);
    if (agendaBtn) agendaBtn.addEventListener('click', showAgenda);
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);
    
    // Add global event delegation for calendar interactions
    document.addEventListener('click', (e) => {
        // Handle calendar day-add-btn clicks
        if (e.target.classList.contains('day-add-btn')) {
            e.stopPropagation();
            const date = e.target.dataset.date;
            if (date) {
                // Check if the date is in the past
                const selectedDate = new Date(date + 'T00:00:00');
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
                
                if (selectedDate < today) {
                    alert('No puedes agregar tareas a fechas pasadas. Por favor selecciona la fecha actual o una fecha futura.');
                    return;
                }
                
                addTask(date);
            }
            return;
        }
        
        // Handle calendar day content clicks
        if (e.target.closest('.day-content') && !e.target.classList.contains('day-add-btn')) {
            const dayContent = e.target.closest('.day-content');
            const day = dayContent.closest('.day:not(.other-month)');
            if (day && day.dataset.date && calendarView && !calendarView.classList.contains('hidden')) {
                e.stopPropagation();
                showDayTasks(day.dataset.date);
            }
        }
    });

    handleOAuthCallback();
    updateLoginButton();
    showCalendar(); // Default view
    checkNotifications();
    setInterval(checkNotifications, 60000); // Check every minute

    console.log('App initialized');
    // Visibility-based pull: when returning to tab, check updates
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkAndPullGist();
        }
    });

});

// Show calendar view
function showCalendar() {
    calendarView.classList.remove('hidden');
    agendaView.classList.add('hidden');
    
    // Update navigation button states
    if (calendarBtn) {
        calendarBtn.classList.add('active');
        calendarBtn.setAttribute('aria-pressed', 'true');
    }
    if (agendaBtn) {
        agendaBtn.classList.remove('active');
        agendaBtn.setAttribute('aria-pressed', 'false');
    }
    
    renderCalendar();
}

// Show agenda view
function showAgenda() {
    agendaView.classList.remove('hidden');
    calendarView.classList.add('hidden');
    
    // Update navigation button states
    if (agendaBtn) {
        agendaBtn.classList.add('active');
        agendaBtn.setAttribute('aria-pressed', 'true');
    }
    if (calendarBtn) {
        calendarBtn.classList.remove('active');
        calendarBtn.setAttribute('aria-pressed', 'false');
    }

    // Try to preserve existing filter values if they exist
    const existingMonthFilter = document.getElementById('month-filter');
    const existingStatusFilter = document.getElementById('status-filter');

    let currentMonthFilter = 'all';
    let currentStatusFilter = 'all';

    if (existingMonthFilter && existingStatusFilter) {
        currentMonthFilter = existingMonthFilter.value || 'all';
        currentStatusFilter = existingStatusFilter.value || 'all';
    }

    renderAgenda(currentMonthFilter, currentStatusFilter);
}

// Render calendar
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    let html = `
        <div class="calendar-nav">
            <button id="prev-month" title="Mes anterior">
                ← ${getMonthName(month === 0 ? 11 : month - 1)}
            </button>
            <h2>${getMonthName(month)} ${year}</h2>
            <button id="next-month" title="Mes siguiente">
                ${getMonthName(month === 11 ? 0 : month + 1)} →
            </button>
        </div>
        <div class="calendar-grid">
            <div class="day">Dom</div>
            <div class="day">Lun</div>
            <div class="day">Mar</div>
            <div class="day">Mié</div>
            <div class="day">Jue</div>
            <div class="day">Vie</div>
            <div class="day">Sáb</div>
    `;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for accurate comparison
    
    for (let date = new Date(startDate); date <= lastDay; date.setDate(date.getDate() + 1)) {
        const dayClass = date.getMonth() === month ? 'day' : 'day other-month';
        const todayClass = isToday(date) ? ' today' : '';
        
        // Check if date is in the past
        const currentDate = new Date(date);
        currentDate.setHours(0, 0, 0, 0);
        const isPastDate = currentDate < today;
        const pastClass = isPastDate ? ' past-date' : '';
        
        const dateKey = formatDate(date);
        const dayTasks = tasks[dateKey] || [];
        const pendingTasks = dayTasks.filter(task => !task.completed).length;
        const completedTasks = dayTasks.filter(task => task.completed).length;
        const totalTasks = pendingTasks + completedTasks;
        
        // Generate task preview with times
        let taskPreview = '';
        if (dayTasks.length > 0) {
            const sortedTasks = dayTasks
                .filter(task => !task.completed)
                .sort((a, b) => {
                    if (!a.time && !b.time) return 0;
                    if (!a.time) return 1;
                    if (!b.time) return -1;
                    return a.time.localeCompare(b.time);
                })
                .slice(0, 2); // Show max 2 tasks
            
            taskPreview = sortedTasks.map(task => {
                const timeStr = task.time ? `${task.time} - ` : '';
                const title = task.title.length > 15 ? task.title.substring(0, 15) + '...' : task.title;
                return `<div class="task-preview" style="font-size: 10px; color: #666; margin: 1px 0;">${timeStr}${title}</div>`;
            }).join('');
        }
        
        html += `<div class="${dayClass}${todayClass}${pastClass}" data-date="${dateKey}">
            <div class="day-content">
                <span class="day-number">${date.getDate()}</span>
                ${totalTasks > 0 ? `<small class="task-count">${pendingTasks} pendiente(s)</small>` : ''}
                ${taskPreview}
                ${!isPastDate ? `<button class="day-add-btn" data-date="${dateKey}" title="Agregar recordatorio">+</button>` : ''}
            </div>
        </div>`;
    }

    html += '</div>';
    calendarView.innerHTML = html;

    // Add event listeners for navigation
    document.getElementById('prev-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById('next-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    // Add event listeners for day clicks and + buttons using event delegation
    // This prevents multiple listeners from being added on re-renders
}

// Render agenda
function renderAgenda(filterMonth = 'all', filterStatus = 'all') {
    let html = `
        <div class="agenda-main">
            <h2>📋 Agenda de Tareas</h2>
            <div class="agenda-filters">
                <select id="month-filter">
                    <option value="all">Todos los meses</option>
                    <option value="0">Enero</option>
                    <option value="1">Febrero</option>
                    <option value="2">Marzo</option>
                    <option value="3">Abril</option>
                    <option value="4">Mayo</option>
                    <option value="5">Junio</option>
                    <option value="6">Julio</option>
                    <option value="7">Agosto</option>
                    <option value="8">Septiembre</option>
                    <option value="9">Octubre</option>
                    <option value="10">Noviembre</option>
                    <option value="11">Diciembre</option>
                </select>
                <select id="status-filter">
                    <option value="all">Todas las tareas</option>
                    <option value="pending">Pendientes</option>
                    <option value="completed">Completadas</option>
                </select>
            </div>
            <ul class="task-list">
    `;

    let allTasks = Object.entries(tasks).flatMap(([date, taskList]) =>
        taskList.map(task => ({ ...task, date: date === 'undated' ? null : date }))
    ).sort((a, b) => {
        // Sort undated tasks first, then by date
        if (!a.date && !b.date) return 0;
        if (!a.date) return -1;
        if (!b.date) return 1;
        return new Date(a.date) - new Date(b.date);
    });

    // Apply filters
    if (filterMonth !== 'all') {
        const targetMonth = parseInt(filterMonth);
        allTasks = allTasks.filter(task => {
            const taskDate = new Date(task.date + 'T00:00:00'); // Ensure consistent timezone
            const taskMonth = taskDate.getMonth();
            return taskMonth === targetMonth;
        });
    }
    if (filterStatus !== 'all') {
        allTasks = allTasks.filter(task => task.completed === (filterStatus === 'completed'));
    }

    allTasks.forEach(task => {
        const completedClass = task.completed ? ' completed' : '';
        const formattedDate = task.date ? formatDateForDisplay(task.date) : 'Sin fecha';
        const timeDisplay = task.time ? ` a las ${task.time}` : '';
        const dateStyle = !task.date ? 'color: #999; font-style: italic;' : '';
        
        html += `<li class="task${completedClass}">
            <div class="task-info">
                <div class="task-content">
                    <h4 class="task-title">${task.title}</h4>
                    <p class="task-meta" style="${dateStyle}">
                        <span class="task-date">${formattedDate}</span>
                        ${timeDisplay ? `<span class="task-time">${timeDisplay}</span>` : ''}
                    </p>
                </div>
                <div class="task-buttons">
                    <button onclick="showTaskInputModal(null, ${JSON.stringify(task).replace(/"/g, '&quot;')})" 
                            class="btn-edit" title="Editar tarea">
                        ✏️ Editar
                    </button>
                    <button onclick="toggleTask('${task.id}'); renderAgenda('${filterMonth}', '${filterStatus}')"
                            class="btn-toggle" title="${task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}">
                        ${task.completed ? '↩️ Desmarcar' : '✅ Completar'}
                    </button>
                    <button onclick="deleteTask('${task.id}')" class="btn-delete" title="Eliminar tarea">
                        🗑️ Eliminar
                    </button>
                </div>
            </div>
        </li>`;
    });
    html += `
            </ul>
        </div>
        <div class="agenda-sidebar">
            <h3>🚀 Acciones Rápidas</h3>
            <div class="quick-actions">
                <button onclick="showTaskInputModal()" class="btn-primary btn-full">
                    ➕ Agregar Tarea Rápida
                </button>
                <button onclick="showPdfExportModal()" class="btn-secondary btn-full">
                    📄 Exportar PDF
                </button>
            </div>
            
            <h3>📊 Estadísticas</h3>
            <div class="stats-container">
                <div class="stat-item">
                    <span class="stat-number">${allTasks.length}</span>
                    <span class="stat-label">Total</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${allTasks.filter(t => t.completed).length}</span>
                    <span class="stat-label">Completadas</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${allTasks.filter(t => !t.completed).length}</span>
                    <span class="stat-label">Pendientes</span>
                </div>
            </div>
            
            <h3>📅 Próximas Tareas</h3>
            <div class="upcoming-tasks">
                ${getUpcomingTasksHTML(allTasks)}
            </div>
        </div>
    `;
    agendaView.innerHTML = html;

    // Add event listeners for filters
    document.getElementById('month-filter').value = filterMonth;
    document.getElementById('status-filter').value = filterStatus;

    document.getElementById('month-filter').addEventListener('change', (e) => {
        renderAgenda(e.target.value, filterStatus);
    });
    document.getElementById('status-filter').addEventListener('change', (e) => {
        renderAgenda(filterMonth, e.target.value);
    });
}

// Generate upcoming tasks HTML for sidebar
function getUpcomingTasksHTML(allTasks) {
    const today = new Date();
    const upcomingTasks = allTasks
        .filter(task => !task.completed && task.date)
        .filter(task => {
            const taskDate = new Date(task.date + 'T00:00:00');
            return taskDate >= today;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);
    
    if (upcomingTasks.length === 0) {
        return '<p class="no-upcoming">No hay tareas próximas programadas</p>';
    }
    
    return upcomingTasks.map(task => {
        const taskDate = new Date(task.date + 'T00:00:00');
        const isToday = taskDate.toDateString() === today.toDateString();
        const isTomorrow = taskDate.toDateString() === new Date(today.getTime() + 24*60*60*1000).toDateString();
        
        let dateLabel = '';
        if (isToday) {
            dateLabel = 'Hoy';
        } else if (isTomorrow) {
            dateLabel = 'Mañana';
        } else {
            dateLabel = formatDateForDisplay(task.date);
        }
        
        return `
            <div class="upcoming-task" onclick="showTaskInputModal(null, ${JSON.stringify(task).replace(/"/g, '&quot;')})">
                <div class="upcoming-task-title">${task.title}</div>
                <div class="upcoming-task-date">${dateLabel}${task.time ? ` - ${task.time}` : ''}</div>
            </div>
        `;
    }).join('');
}

// Add task
function addTask(date) {
    // Create a modal for task input with time option
    showTaskInputModal(date);
}

// Show task input modal
function showTaskInputModal(date = null, existingTask = null) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h3>${existingTask ? 'Editar Tarea' : (date ? 'Nueva Tarea' : 'Nueva Tarea Rápida')}</h3>
            <div style="margin: 15px 0;">
                <label for="task-title-input">Título:</label>
                <input type="text" id="task-title-input" placeholder="Ingrese el título de la tarea" 
                       value="${existingTask ? existingTask.title : ''}" 
                       style="width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            ${!date ? `
            <div style="margin: 15px 0;">
                <label for="task-date-input">Fecha (opcional):</label>
                <input type="date" id="task-date-input" 
                       value="${existingTask && existingTask.date ? existingTask.date : ''}"
                       style="width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            ` : ''}
            <div style="margin: 15px 0;">
                <label for="task-time-input">Hora (opcional):</label>
                <input type="time" id="task-time-input" 
                       value="${existingTask && existingTask.time ? existingTask.time : ''}"
                       style="width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div style="margin: 15px 0;">
                <label>
                    <input type="checkbox" id="task-reminder-input" ${existingTask ? (existingTask.isReminder ? 'checked' : '') : 'checked'}>
                    Es un recordatorio
                </label>
            </div>
            <div style="text-align: right; margin-top: 20px;">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                        style="background: #f44336; color: white; border: none; padding: 8px 16px; margin-right: 8px; cursor: pointer; border-radius: 4px;">
                    Cancelar
                </button>
                <button onclick="saveTaskFromModal('${date || ''}', ${existingTask ? `'${existingTask.id}'` : 'null'})" 
                        style="background: #4CAF50; color: white; border: none; padding: 8px 16px; cursor: pointer; border-radius: 4px;">
                    ${existingTask ? 'Actualizar' : 'Guardar'}
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.getElementById('task-title-input').focus();
}

// Save task from modal
function saveTaskFromModal(originalDate, existingTaskId) {
    const titleInput = document.getElementById('task-title-input');
    const dateInput = document.getElementById('task-date-input');
    const timeInput = document.getElementById('task-time-input');
    const reminderInput = document.getElementById('task-reminder-input');
    
    // Get and validate title
    if (!titleInput || !titleInput.value) {
        alert('Por favor ingrese un título para la tarea');
        return;
    }
    
    const title = titleInput.value.trim();
    if (!title || title.length === 0) {
        alert('Por favor ingrese un título para la tarea');
        return;
    }
    
    console.log('Title validation:', {
        raw: titleInput.value,
        trimmed: title,
        length: title.length
    });
    
    // Handle date properly - ensure we never send empty string
    let taskDate = null;
    if (dateInput && dateInput.value && dateInput.value.trim() !== '') {
        taskDate = dateInput.value;
    } else if (originalDate && originalDate.trim() !== '') {
        taskDate = originalDate;
    }
    // If taskDate is still empty string, set it to null
    if (taskDate === '') {
        taskDate = null;
    }
    
    const time = timeInput.value || null;
    const isReminder = reminderInput.checked;
    
    console.log('saveTaskFromModal - Raw values:', {
        originalDate,
        dateInputValue: dateInput ? dateInput.value : 'no input',
        taskDate,
        time,
        isReminder
    });
    
    if (existingTaskId) {
        // Update existing task
        updateExistingTask(existingTaskId, title, taskDate, time, isReminder);
    } else {
        // Create new task
        const task = {
            id: Date.now().toString(),
            title: title,
            date: taskDate,
            time: time,
            completed: false,
            isReminder: isReminder
        };
        
        if (taskDate) {
            // Task with date - add to calendar
            if (!tasks[taskDate]) tasks[taskDate] = [];
            tasks[taskDate].push(task);
        } else {
            // Undated task - add to special undated tasks array
            if (!tasks['undated']) tasks['undated'] = [];
            tasks['undated'].push(task);
        }
        
        // Always save to localStorage first for immediate persistence
        localStorage.setItem('calendarTasks', JSON.stringify(tasks));

        // Then try to sync with backend if user is logged in
        if (userSession && userSession.jwt) {
            showSyncStatus('Guardando en servidor…');
            
            // Double-check title is valid
            const cleanTitle = task.title.trim();
            if (!cleanTitle || cleanTitle.length === 0) {
                console.error('Title is empty after trim!');
                alert('El título no puede estar vacío');
                return;
            }
            
            if (cleanTitle.length > 500) {
                alert('El título no puede tener más de 500 caracteres');
                return;
            }
            
            // Send complete task data to backend
            const backendData = {
                title: cleanTitle,
                description: task.description || null,
                date: taskDate || null,
                time: time || null,
                completed: false,
                is_reminder: isReminder,
                priority: 1,
                tags: []
            };
            
            console.log('=== SENDING TO BACKEND (COMPLETE DATA) ===');
            console.log('Raw JSON:', JSON.stringify(backendData));
            console.log('Title type:', typeof backendData.title);
            console.log('Title length:', backendData.title.length);
            console.log('Title value:', `"${backendData.title}"`);
            console.log('Title charCodes:', Array.from(backendData.title).map(c => c.charCodeAt(0)));
            
            apiFetch('/api/tasks', {
                method: 'POST',
                body: JSON.stringify(backendData)
            }).then(async (res) => {
                if (!res.ok) {
                    const errorText = await res.text();
                    console.error('Backend error response:', errorText);
                    
                    // Check for authentication errors
                    if (res.status === 401) {
                        console.error('Authentication error - token expired or invalid');
                        alert('Tu sesión ha expirado. Por favor, cierra sesión y vuelve a iniciar sesión.');
                        // Optionally, auto-logout the user
                        handleLogout();
                        throw new Error('Authentication failed');
                    }
                    
                    try {
                        const errorData = JSON.parse(errorText);
                        console.error('Parsed error data:', errorData);
                        if (errorData.details) {
                            console.error('Validation details:', errorData.details);
                            errorData.details.forEach(detail => {
                                console.error(`Field '${detail.path}': ${detail.msg}`);
                            });
                        }
                        if (errorData.errors) {
                            console.error('Additional errors:', errorData.errors);
                        }
                    } catch (e) {
                        console.error('Could not parse error response as JSON');
                    }
                    throw new Error('HTTP ' + res.status);
                }
                const created = await res.json();
                if (created && created.data && created.data.id) {
                    const newId = String(created.data.id);
                    // Update the task ID in memory and localStorage
                    if (taskDate) {
                        const idx = tasks[taskDate].findIndex(t => t.id === task.id);
                        if (idx !== -1) {
                            tasks[taskDate][idx].id = newId;
                            localStorage.setItem('calendarTasks', JSON.stringify(tasks));
                        }
                    } else {
                        const idx = tasks['undated'].findIndex(t => t.id === task.id);
                        if (idx !== -1) {
                            tasks['undated'][idx].id = newId;
                            localStorage.setItem('calendarTasks', JSON.stringify(tasks));
                        }
                    }
                }
                showSyncStatus('Guardado ✅');
            }).catch(err => {
                console.error('Create task failed:', err);
                showSyncStatus('Guardado localmente (sin conexión)', true);
            }).finally(() => {
                renderCalendar();
                if (document.querySelector('#agenda-view:not(.hidden)')) {
                    renderAgenda();
                }
            });
        } else {
            // For non-backend users, just save locally
            renderCalendar();
            if (document.querySelector('#agenda-view:not(.hidden)')) {
                renderAgenda();
            }
        }
        
        // Request notification permission for reminders
        if (isReminder && 'Notification' in window) {
            requestNotificationPermission();
        }
    }
    
    // Close modal
    document.querySelector('.modal').remove();
}

// Update existing task
function updateExistingTask(taskId, title, newDate, time, isReminder) {
    let taskFound = false;
    let oldDate = null;
    
    // Find and update the task
    Object.keys(tasks).forEach(date => {
        const taskIndex = tasks[date].findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            oldDate = date;
            const task = tasks[date][taskIndex];
            
            // Update task properties
            task.title = title;
            task.time = time;
            task.isReminder = isReminder;
            
            // If date changed, move task to new date
            if (newDate !== oldDate) {
                // Remove from old date
                tasks[date].splice(taskIndex, 1);
                if (tasks[date].length === 0 && date !== 'undated') {
                    delete tasks[date];
                }
                
                // Add to new date
                task.date = newDate;
                if (newDate) {
                    if (!tasks[newDate]) tasks[newDate] = [];
                    tasks[newDate].push(task);
                } else {
                    if (!tasks['undated']) tasks['undated'] = [];
                    tasks['undated'].push(task);
                }
            }
            
            taskFound = true;
        }
    });
    
    if (taskFound) {
        // Always save to localStorage first for immediate persistence
        localStorage.setItem('calendarTasks', JSON.stringify(tasks));

        // Then try to sync with backend if user is logged in
        if (userSession && userSession.jwt) {
            showSyncStatus('Actualizando en servidor…');
            const serverId = /^\d+$/.test(taskId) ? taskId : null;
            if (serverId) {
                apiFetch(`/api/tasks/${serverId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        title: title,
                        date: (newDate && newDate !== 'undated' && newDate !== '') ? newDate : null,
                        time: (time && time !== '') ? time : null,
                        is_reminder: isReminder
                    })
                }).then(res => {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    showSyncStatus('Actualizado ✅');
                }).catch(err => {
                    console.error('Update task failed:', err);
                    showSyncStatus('Actualizado localmente (sin conexión)', true);
                });
            } else {
                pushTasksToBackend();
            }
        }

        renderCalendar();
        if (document.querySelector('#agenda-view:not(.hidden)')) {
            renderAgenda();
        }
    }
    
    // Close modal after updating task
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

// Legacy addTask function for compatibility
function addTaskLegacy(date) {
    const title = prompt('Ingrese el título del recordatorio:');
    if (title && title.trim()) {
        const task = {
            id: Date.now().toString(),
            title: title.trim(),
            date,
            time: null,
            completed: false,
            isReminder: true
        };
        if (!tasks[date]) tasks[date] = [];
        tasks[date].push(task);
        // Always save to localStorage first for immediate persistence
        localStorage.setItem('calendarTasks', JSON.stringify(tasks));

        // Then try to sync with backend if user is logged in
        if (userSession && userSession.jwt) {
            showSyncStatus('Guardando en servidor…');
            apiFetch('/api/tasks', {
                method: 'POST',
                body: JSON.stringify({
                    title: task.title,
                    description: null,
                    date: (task.date && task.date !== 'undated' && task.date !== '') ? task.date : null,
                    time: (task.time && task.time !== '') ? task.time : null,
                    completed: Boolean(task.completed),
                    is_reminder: Boolean(task.isReminder),
                    priority: parseInt(task.priority || 1, 10),
                    tags: Array.isArray(task.tags) ? task.tags : []
                })
            }).then(async (res) => {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const created = await res.json();
                // Use server id if available
                if (created && created.data && created.data.id) {
                    const newId = String(created.data.id);
                    const idx = tasks[date].findIndex(t => t.id === task.id);
                    if (idx !== -1) {
                        tasks[date][idx].id = newId;
                        localStorage.setItem('calendarTasks', JSON.stringify(tasks));
                    }
                }
                showSyncStatus('Guardado ✅');
            }).catch(err => {
                console.error('Create task failed:', err);
                showSyncStatus('Guardado localmente (sin conexión)', true);
            }).finally(() => {
                renderCalendar();
            });
        } else {
            renderCalendar();
        }

        // Request notification permission for reminders
        if ('Notification' in window) {
            requestNotificationPermission();
        }
    }
}

// Alternative: Custom input form (uncomment to use instead of prompt)
/*
function addTask(date) {
    const modal = document.getElementById('day-modal');
    const modalTasks = document.getElementById('modal-tasks');

    // Create input form
    const inputForm = document.createElement('div');
    inputForm.innerHTML = `
        <input type="text" id="task-input" placeholder="Ingrese el título del recordatorio" style="width: 100%; padding: 8px; margin: 10px 0;">
        <button id="save-task-btn" style="background: #4CAF50; color: white; border: none; padding: 8px 16px; margin-right: 8px; cursor: pointer;">Guardar</button>
        <button id="cancel-task-btn" style="background: #f44336; color: white; border: none; padding: 8px 16px; cursor: pointer;">Cancelar</button>
    `;

    modalTasks.appendChild(inputForm);

    const input = document.getElementById('task-input');
    const saveBtn = document.getElementById('save-task-btn');
    const cancelBtn = document.getElementById('cancel-task-btn');

    input.focus();

    const cleanup = () => {
        if (inputForm.parentNode) {
            inputForm.parentNode.removeChild(inputForm);
        }
    };

    saveBtn.onclick = () => {
        const title = input.value.trim();
        if (title) {
            const task = {
                id: Date.now().toString(),
                title,
                date,
                completed: false,
                isReminder: true
            };
            if (!tasks[date]) tasks[date] = [];
            tasks[date].push(task);
            saveTasks();
            renderCalendar();
            showDayTasks(date); // Refresh the modal

            // Request notification permission for reminders
            if ('Notification' in window) {
                requestNotificationPermission();
            }
        }
        cleanup();
    };

    cancelBtn.onclick = cleanup;

    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            saveBtn.click();
        } else if (e.key === 'Escape') {
            cancelBtn.click();
        }
    };
}
*/

// Toggle task completion
function toggleTask(id) {
    Object.values(tasks).forEach(taskList => {
        const task = taskList.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
        }
    });
    // Always save to localStorage first for immediate persistence
    localStorage.setItem('calendarTasks', JSON.stringify(tasks));

    // Then try to sync with backend if user is logged in
    if (userSession && userSession.jwt) {
        // Find the task with its date and possible numeric server id
        let found = null;
        let foundDate = null;
        Object.entries(tasks).some(([date, list]) => {
            const t = list.find(x => x.id === id);
            if (t) { found = t; foundDate = date; return true; }
            return false;
        });
        if (found) {
            showSyncStatus('Actualizando en servidor…');
            const serverId = /^\d+$/.test(found.id) ? found.id : null;
            // If no server id yet (string timestamp), fallback to reconcile
            const doUpdate = serverId ? apiFetch(`/api/tasks/${serverId}`, {
                method: 'PUT',
                body: JSON.stringify({ completed: found.completed })
            }) : pushTasksToBackend();
            Promise.resolve(doUpdate).then(res => {
                if (res && !res.ok) throw new Error('HTTP ' + res.status);
                showSyncStatus('Actualizado ✅');
            }).catch(err => {
                console.error('Toggle task failed:', err);
                showSyncStatus('Actualizado localmente (sin conexión)', true);
            });
        }
    }

    // Get current filter values and re-render agenda with them
    const monthFilter = document.getElementById('month-filter');
    const statusFilter = document.getElementById('status-filter');
    const currentMonthFilter = monthFilter ? monthFilter.value : 'all';
    const currentStatusFilter = statusFilter ? statusFilter.value : 'all';

    renderAgenda(currentMonthFilter, currentStatusFilter);
    renderCalendar(); // Update calendar to reflect new task count
}

// Delete task
function deleteTask(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este recordatorio?')) {
        // Remove from tasks object
        Object.keys(tasks).forEach(date => {
            tasks[date] = tasks[date].filter(task => task.id !== id);
            // Remove empty date arrays
            if (tasks[date].length === 0) {
                delete tasks[date];
            }
        });

        // Always save to localStorage first for immediate persistence
        localStorage.setItem('calendarTasks', JSON.stringify(tasks));

        // Then try to sync with backend if user is logged in
        if (userSession && userSession.jwt) {
            // Locate server id if present
            const serverId = id && /^\d+$/.test(id) ? id : null;
            showSyncStatus('Eliminando en servidor…');
            const doDelete = serverId ? apiFetch(`/api/tasks/${serverId}`, { method: 'DELETE' }) : pushTasksToBackend();
            Promise.resolve(doDelete).then(res => {
                if (res && !res.ok) throw new Error('HTTP ' + res.status);
                showSyncStatus('Eliminado ✅');
            }).catch(err => {
                console.error('Delete task failed:', err);
                showSyncStatus('Eliminado localmente (sin conexión)', true);
            });
        }

        // Get current filter values and re-render agenda with them
        const monthFilter = document.getElementById('month-filter');
        const statusFilter = document.getElementById('status-filter');
        const currentMonthFilter = monthFilter ? monthFilter.value : 'all';
        const currentStatusFilter = statusFilter ? statusFilter.value : 'all';

        renderAgenda(currentMonthFilter, currentStatusFilter);
        renderCalendar(); // Update calendar to reflect new task count

        // If we're in the modal, close it or refresh it
        const modal = document.getElementById('day-modal');
        if (modal && !modal.classList.contains('hidden')) {
            const date = modal.querySelector('#modal-date').textContent;
            // Try to parse the date and refresh the modal
            const dateMatch = date.match(/(\d{1,2}) de (\w+) de (\d{4})/);
            if (dateMatch) {
                const day = dateMatch[1].padStart(2, '0');
                const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                const month = (monthNames.indexOf(dateMatch[2].toLowerCase()) + 1).toString().padStart(2, '0');
                const year = dateMatch[3];
                const formattedDate = `${year}-${month}-${day}`;
                showDayTasks(formattedDate);
            }
        }
    }
}

// Save tasks to localStorage and sync to GitHub Gist when applicable.
// When logged-in with backend JWT, per-action API calls handle persistence; avoid bulk reconcile here.
async function saveTasks() {
    localStorage.setItem('calendarTasks', JSON.stringify(tasks));
    if (userSession && userSession.jwt) {
        return; // per-action backend sync already performed where needed
    } else if (userSession && userSession.token) {
        await syncTasksToGist();
    }
}

// Load tasks from GitHub Gist
async function loadTasksFromGist() {
    if (!userSession || !userSession.token || !userGistId) {
        return false;
    }

    try {
        const response = await fetch(`https://api.github.com/gists/${userGistId}`, {
            headers: {
                'Authorization': `token ${userSession.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.ok) {
            const gist = await response.json();
            const tasksData = gist.files['calendar-tasks.json'];

            if (tasksData && tasksData.content) {
                const remoteTasks = JSON.parse(tasksData.content);
                tasks = mergeTasksById(tasks, remoteTasks);
                localStorage.setItem('calendarTasks', JSON.stringify(tasks));
                if (gist.updated_at) {
                    lastGistUpdatedAt = gist.updated_at;
                    localStorage.setItem('lastGistUpdatedAt', lastGistUpdatedAt);
                }
                return true;
            }
        }
    } catch (error) {
        console.error('Error loading tasks from Gist:', error);
    }

    return false;
}

// Load tasks from backend
async function loadTasksFromBackend() {
    if (!userSession || !userSession.jwt) return;
    try {
        const res = await apiFetch('/api/tasks?limit=100&offset=0');
        if (!res.ok) throw new Error('Tasks list HTTP ' + res.status);
        const data = await res.json();
        const list = data.data || [];
        const byDate = {};
        list.forEach(t => {
            const dateKey = (t.date || '').slice(0,10) || 'undated';
            if (!byDate[dateKey]) byDate[dateKey] = [];
            byDate[dateKey].push({
                id: String(t.id),
                title: t.title,
                description: t.description || '',
                date: dateKey === 'undated' ? null : dateKey,
                time: t.time || null,
                completed: !!t.completed,
                isReminder: t.is_reminder !== undefined ? t.is_reminder : true,
                priority: t.priority || 1,
                tags: t.tags || []
            });
        });
        tasks = byDate;
        localStorage.setItem('calendarTasks', JSON.stringify(tasks));
        renderCalendar();
        return true;
    } catch (e) {
        console.error('Error loading tasks from backend:', e);
        return false;
    }
}

// Push local tasks to backend by reconciling with server
async function pushTasksToBackend() {
    try {
        const res = await apiFetch('/api/tasks?limit=100&offset=0');
        const server = res.ok ? (await res.json()).data : [];
        const serverById = new Map(server.map(t => [String(t.id), t]));

        // Build local flat list
        const localList = Object.entries(tasks).flatMap(([date, list]) => list.map(t => ({...t, date})));
        const localById = new Map(localList.map(t => [String(t.id), t]));

        // Create or update
        for (const t of localList) {
            const existing = serverById.get(String(t.id));
            if (!existing) {
                await apiFetch('/api/tasks', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: t.title,
                        description: t.description || null,
                        date: (t.date && t.date !== 'undated' && t.date !== '') ? t.date : null,
                        time: (t.time && t.time !== '') ? t.time : null,
                        completed: Boolean(t.completed),
                        is_reminder: t.isReminder !== undefined ? Boolean(t.isReminder) : true,
                        priority: parseInt(t.priority || 1, 10),
                        tags: Array.isArray(t.tags) ? t.tags : []
                    })
                });
            } else {
                const diff = {};
                if (existing.title !== t.title) diff.title = t.title;
                if ((existing.description||'') !== (t.description||'')) diff.description = t.description || null;
                const exDate = (existing.date||'').slice(0,10);
                const taskDate = (t.date && t.date !== 'undated') ? t.date : null;
                if (exDate !== taskDate) diff.date = taskDate;
                if (!!existing.completed !== !!t.completed) diff.completed = !!t.completed;
                const exRem = existing.is_reminder !== undefined ? existing.is_reminder : true;
                const loRem = t.isReminder !== undefined ? t.isReminder : true;
                if (exRem !== loRem) diff.is_reminder = loRem;
                if ((existing.priority||1) !== (t.priority||1)) diff.priority = t.priority || 1;
                const exTags = JSON.stringify(existing.tags||[]);
                const loTags = JSON.stringify(t.tags||[]);
                if (exTags !== loTags) diff.tags = t.tags||[];
                if (Object.keys(diff).length > 0) {
                    await apiFetch(`/api/tasks/${existing.id}`, { method: 'PUT', body: JSON.stringify(diff) });
                }
            }
        }

        // Delete removed on server
        for (const s of server) {
            if (!localById.has(String(s.id))) {
                await apiFetch(`/api/tasks/${s.id}`, { method: 'DELETE' });
            }
        }
    } catch (e) {
        console.error('Error pushing tasks to backend:', e);
    }
}

// Sync tasks to GitHub Gist
async function syncTasksToGist() {
    if (!userSession || !userSession.token) {
        return;
    }

    try {
        const gistData = {
            description: 'Calendario Digital - Tasks Data',
            public: false,
            files: {
                'calendar-tasks.json': {
                    content: JSON.stringify(tasks, null, 2)
                }
            }
        };

        let response;
        if (userGistId) {
            // Update existing gist
            response = await fetch(`https://api.github.com/gists/${userGistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${userSession.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify(gistData)
            });
        } else {
            // Create new gist
            response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${userSession.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify(gistData)
            });
        }

        if (response.ok) {
            const gist = await response.json();
            userGistId = gist.id;
            localStorage.setItem('userGistId', userGistId);
            if (gist.updated_at) {
                lastGistUpdatedAt = gist.updated_at;
                localStorage.setItem('lastGistUpdatedAt', lastGistUpdatedAt);
            }
            console.log('Tasks synced to Gist successfully');
        } else {
            console.error('Failed to sync tasks to Gist:', response.status);
        }
    } catch (error) {
        console.error('Error syncing tasks to Gist:', error);
    }
}

// Helper functions
function getMonthName(month) {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return months[month];
}

function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Request notification permission
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        return Notification.requestPermission();
    }
    return Promise.resolve(Notification.permission);
}

// Check notifications
function checkNotifications() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const today = formatDate(new Date());
    Object.entries(tasks).forEach(([date, taskList]) => {
        if (date === today) {
            taskList.forEach(task => {
                if (!task.completed && task.isReminder) {
                    new Notification('Recordatorio', {
                        body: task.title,
                        icon: '/favicon.ico' // Add an icon if available
                    });
                }
            });
        }
    });
}

// Handle OAuth callback
function handleOAuthCallback() {
    const hash = window.location.hash;
    const search = window.location.search;
    console.log('🔍 handleOAuthCallback called with hash:', hash, ' search:', search);

    // Authorization Code Flow (requires proxy to exchange)
    const searchParams = new URLSearchParams(search);
    const authCode = searchParams.get('code');
    if (authCode && !userSession) {
        console.log('📥 Found authorization code in URL');
        // CSRF check: state must match
        const returnedState = searchParams.get('state');
        const storedState = localStorage.getItem('oauth_state');
        if (storedState && returnedState && returnedState !== storedState) {
            console.error('OAuth state mismatch');
            showAuthStatus('Autenticación inválida. Intenta nuevamente.', true);
            return;
        }
        if (storedState) localStorage.removeItem('oauth_state');
        if (OAUTH_PROXY_URL) {
            showAuthStatus('Intercambiando código por token…');
            // Backend: POST /api/auth/github -> { success, token, user }
            fetch(OAUTH_PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ code: authCode, redirect_uri: GITHUB_REDIRECT_URI })
            })
            .then(async (res) => {
                if (!res.ok) throw new Error('Auth HTTP ' + res.status);
                return res.json();
            })
            .then((data) => {
                if (!data || !data.success || !data.token || !data.user) throw new Error('Auth payload inválido');
                userSession = {
                    jwt: data.token,
                    user: data.user,
                    loginTime: Date.now()
                };
                localStorage.setItem('userSession', JSON.stringify(userSession));
                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
                updateLoginButton();
                // Load tasks from backend
                loadTasksFromBackend().then(() => {
                    scheduleBackgroundSync();
                    showAuthStatus('Inicio de sesión exitoso');
                });
            })
            .catch(err => {
                console.error('Code exchange failed:', err);
                showAuthStatus('Error al intercambiar el código (ver consola)', true);
            });
            return; // Stop further handling
        } else {
            console.warn('OAUTH_PROXY_URL no configurado; no se puede usar el Authorization Code Flow sin backend.');
            showAuthStatus('No hay backend para intercambio de código. Usando Device Flow.', true);
        }
    }

    if (hash.includes('access_token')) {
        console.log('✅ Access token found in hash');
        const hashParams = hash.substring(1); // Remove the #
        const params = new URLSearchParams(hashParams);
        const token = params.get('access_token');
        console.log('🔑 Token extracted:', token ? 'Present' : 'Missing');

        if (token) {
            userSession = { token, loginTime: Date.now() };
            localStorage.setItem('userSession', JSON.stringify(userSession));
            console.log('💾 User session stored:', userSession);

            // Clean URL by removing hash
            window.location.hash = '';

            // Update URL without hash
            const newUrl = window.location.pathname + window.location.search;
            window.history.replaceState({}, document.title, newUrl);

            console.log('🚀 Calling fetchUserInfo...');
            fetchUserInfo(token);
        } else {
            console.log('❌ No token found in URL parameters');
        }
    } else {
        console.log('❌ No access_token found in hash');

        // Check if we have a stored session
        const storedSession = localStorage.getItem('userSession');
        if (storedSession) {
            try {
                userSession = JSON.parse(storedSession);
                console.log('📦 Loaded stored session:', userSession);
                if (userSession && userSession.user) {
                    console.log('👤 User already logged in, updating UI');
                    updateLoginButton();
                    if (userSession.jwt) {
                        loadTasksFromBackend().then(() => scheduleBackgroundSync());
                    } else {
                        findExistingGist().then(loadTasksFromGist).then(() => {
                            scheduleBackgroundSync();
                        });
                    }
                } else if (userSession && userSession.token) {
                    fetchUserInfo(userSession.token).then(() => {
                        scheduleBackgroundSync();
                    });
                }
            } catch (e) {
                console.error('❌ Error parsing stored session:', e);
                localStorage.removeItem('userSession');
            }
        }
    }
}

async function exchangeCodeForToken(code) {
    if (!OAUTH_PROXY_URL) return null;
    try {
        const res = await fetch(OAUTH_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ code, redirect_uri: GITHUB_REDIRECT_URI })
        });
        if (!res.ok) {
            throw new Error('Proxy HTTP ' + res.status);
        }
        const data = await res.json();
        if (data.error) throw new Error(data.error_description || data.error);
        return data.access_token;
    } catch (e) {
        console.error('exchangeCodeForToken error:', e);
        return null;
    }
}

function showAuthStatus(message, isError = false) {
    let el = document.getElementById('auth-status-banner');
    if (!el) {
        el = document.createElement('div');
        el.id = 'auth-status-banner';
        el.style.position = 'fixed';
        el.style.top = '0';
        el.style.left = '50%';
        el.style.transform = 'translateX(-50%)';
        el.style.padding = '6px 14px';
        el.style.fontSize = '12px';
        el.style.fontFamily = 'JetBrains Mono, monospace';
        el.style.borderRadius = '0 0 8px 8px';
        el.style.zIndex = '99999';
        el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.background = isError ? '#d1495b' : '#545f66';
    el.style.color = '#fff';
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }, isError ? 6000 : 3500);
}

// Small banner for sync operations
function showSyncStatus(message, isError = false) {
    let el = document.getElementById('sync-status-banner');
    if (!el) {
        el = document.createElement('div');
        el.id = 'sync-status-banner';
        el.style.position = 'fixed';
        el.style.bottom = '16px';
        el.style.left = '16px';
        el.style.padding = '6px 12px';
        el.style.fontSize = '12px';
        el.style.fontFamily = 'JetBrains Mono, monospace';
        el.style.borderRadius = '8px';
        el.style.zIndex = '99999';
        el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
        el.style.maxWidth = '60vw';
        el.style.whiteSpace = 'nowrap';
        el.style.overflow = 'hidden';
        el.style.textOverflow = 'ellipsis';
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.background = isError ? '#d1495b' : '#829399';
    el.style.color = '#fff';
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }, isError ? 5000 : 2200);
}

// Fetch user info
async function fetchUserInfo(token) {
    console.log('fetchUserInfo called with token');
    try {
        let user;
        if (userSession && userSession.jwt) {
            const res = await apiFetch('/api/auth/me');
            if (!res.ok) throw new Error('Auth/me HTTP ' + res.status);
            const data = await res.json();
            user = data.user;
        } else {
            console.log('Making API call to GitHub...');
            const response = await fetch('https://api.github.com/user', {
                headers: { Authorization: `token ${token}` }
            });
            console.log('GitHub API response status:', response.status);
            if (!response.ok) {
                console.error('GitHub API error:', response.status, response.statusText);
                return;
            }
            user = await response.json();
            console.log('GitHub user data received:', user);
        }

        userSession.user = user;
        localStorage.setItem('userSession', JSON.stringify(userSession));
        console.log('User session updated with user data');

    // Discover existing gist and load tasks after successful login
    await findExistingGist();
    await loadTasksFromGist();

        console.log('Calling updateLoginButton...');
        updateLoginButton();

    // Refresh the UI to show loaded data
    showCalendar();
    // Start background sync
    scheduleBackgroundSync();
        console.log('UI refreshed after login');
    } catch (error) {
        console.error('Error fetching user info:', error);
    }
}

// Update login button
function updateLoginButton() {
    console.log('🔄 updateLoginButton called');
    console.log('👤 userSession:', userSession);
    console.log('👤 userSession.user:', userSession?.user);

    // Get fresh references to DOM elements
    const loginBtn = document.getElementById('login-btn');
    const userInfo = document.getElementById('user-info');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const logoutBtn = document.getElementById('logout-btn');

    console.log('🔍 DOM elements check:', {
        loginBtn: !!loginBtn,
        userInfo: !!userInfo,
        userAvatar: !!userAvatar,
        userName: !!userName,
        logoutBtn: !!logoutBtn
    });

    if (userSession && userSession.user) {
        // User is logged in - show user info
        console.log('✅ User is logged in, updating UI');

        if (loginBtn) {
            loginBtn.style.display = 'none';
            console.log('🙈 Login button hidden');
        }

        if (userInfo) {
            userInfo.style.display = 'flex';
            userInfo.classList.remove('hidden');
            userInfo.classList.add('show');
            console.log('👁️ User info shown');
        }

        if (userAvatar) {
            if (userSession.user.avatar_url) {
                userAvatar.src = userSession.user.avatar_url;
                userAvatar.style.display = 'block';
                userAvatar.onerror = function() {
                    console.log('❌ Avatar failed to load, using fallback');
                    userAvatar.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2MjY0NjciLz4KPHBhdGggZD0iTTIwIDIwaC00djRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNFoiIGZpbGw9IiNmZmYiLz4KPHBhdGggZD0iTTIyIDI0SDR2LTJjMC0yLjIgMS44LTQgNC00aDEwdjRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNFoiIGZpbGw9IiNmZmYiLz4KPC9zdmc+';
                };
                console.log('🖼️ Avatar URL set:', userSession.user.avatar_url);
            } else {
                // Fallback avatar
                userAvatar.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2MjY0NjciLz4KPHBhdGggZD0iTTIwIDIwaC00djRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNFoiIGZpbGw9IiNmZmYiLz4KPHBhdGggZD0iTTIyIDI0SDR2LTJjMC0yLjIgMS44LTQgNC00aDEwdjRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNFoiIGZpbGw9IiNmZmYiLz4KPC9zdmc+';
                userAvatar.style.display = 'block';
                console.log('🖼️ Using fallback avatar');
            }
        }

        if (userName) {
            userName.textContent = userSession.user.name || userSession.user.login || 'Usuario';
            console.log('📝 User name set to:', userSession.user.name || userSession.user.login);
        }

        // Add logout event listener
        if (logoutBtn) {
            logoutBtn.onclick = handleLogout;
            logoutBtn.style.display = 'inline-block';
            console.log('🚪 Logout button event listener added');
        }

        // Add online status indicator
        const userStatus = document.getElementById('user-status');
        if (userStatus && !userStatus.querySelector('.online-indicator')) {
            const onlineIndicator = document.createElement('span');
            onlineIndicator.className = 'online-indicator';
            onlineIndicator.textContent = '●';
            onlineIndicator.title = 'En línea';
            userInfo.appendChild(onlineIndicator);
        }

    } else {
        // User is not logged in - show login button
        console.log('❌ User is not logged in, showing login button');

        if (loginBtn) {
            loginBtn.style.display = 'flex';
            console.log('👁️ Login button shown');
        }

        if (userInfo) {
            userInfo.style.display = 'none';
            userInfo.classList.add('hidden');
            userInfo.classList.remove('show');
            console.log('🙈 User info hidden');
        }

        // Remove online indicator if exists
        const onlineIndicator = document.querySelector('.online-indicator');
        if (onlineIndicator) {
            onlineIndicator.remove();
        }
    }
}

// Handle login (Authorization Code Flow with state)
function handleLogin() {
    console.log('Redirecting to GitHub for Authorization Code Flow...');
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('oauth_state', state);
    const url = new URL(GITHUB_AUTH_URL);
    url.searchParams.set('state', state);
    window.location.href = url.toString();
}

// Handle logout
function handleLogout() {
    console.log('Logging out user...');
    userSession = null;
    userGistId = null;
    localStorage.removeItem('userSession');
    localStorage.removeItem('userGistId');
    // Clear tasks and reload from localStorage only
    tasks = JSON.parse(localStorage.getItem('calendarTasks')) || {};
    updateLoginButton();
    // Refresh the UI
    showCalendar();
    console.log('User logged out successfully');
}

// Show tasks for a specific day
function showDayTasks(date) {
    const modal = document.getElementById('day-modal');
    const modalDate = document.getElementById('modal-date');
    const modalTasks = document.getElementById('modal-tasks');
    const addTaskBtn = document.getElementById('add-task-modal-btn');

    if (!modal || !modalDate || !modalTasks || !addTaskBtn) {
        console.error('Modal elements not found');
        return;
    }

    modalDate.textContent = formatDateForDisplay(date);
    modalTasks.innerHTML = '';

    const dayTasks = tasks[date] || [];
    if (dayTasks.length === 0) {
        modalTasks.innerHTML = '<p>No hay tareas para este día.</p>';
    } else {
        dayTasks.forEach(task => {
            const taskDiv = document.createElement('div');
            taskDiv.className = `modal-task ${task.completed ? 'completed' : 'pending'}`;
            taskDiv.innerHTML = `
                <div class="task-content">
                    <strong>${task.title}</strong>
                    <div class="task-actions">
                        <button onclick="toggleTask('${task.id}'); setTimeout(() => showDayTasks('${date}'), 100)">
                            ${task.completed ? 'Desmarcar' : 'Marcar como hecho'}
                        </button>
                        <button onclick="deleteTask('${task.id}')" class="delete-btn">
                            🗑️ Eliminar
                        </button>
                    </div>
                </div>
            `;
            modalTasks.appendChild(taskDiv);
        });
    }

    addTaskBtn.onclick = () => addTask(date);

    modal.classList.remove('hidden');
    modal.style.display = 'flex'; // Override the inline style

    // Close modal when clicking outside or on close button
    const closeBtn = modal.querySelector('.close-btn');
    if (!closeBtn) {
        console.error('Close button not found');
        return;
    }

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.style.display = 'none'; // Restore the inline style
        // Clean up event listeners
        document.removeEventListener('keydown', handleEscape);
    };

    closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeModal();
    };

    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };

    // Also close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// Format date for display in modal
function formatDateForDisplay(dateString) {
    const date = new Date(dateString + 'T00:00:00'); // Ensure consistent timezone
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
}

// ===== OAuth Device Flow (for static sites) =====
async function startDeviceFlowLogin() {
    // Request a device code
    const params = new URLSearchParams();
    params.set('client_id', GITHUB_CLIENT_ID);
    params.set('scope', 'user,gist');

    const res = await fetch(GITHUB_DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        body: params
    });

    if (!res.ok) throw new Error('No se pudo iniciar el Device Flow');
    const data = await res.json();
    // Expected: { device_code, user_code, verification_uri, expires_in, interval }
    showAuthModal(data);
    await pollForDeviceToken(data);
}

function showAuthModal(data) {
    // Reuse modal styling
    const existing = document.getElementById('auth-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 520px;">
            <span class="close-btn" title="Cerrar">&times;</span>
            <h3>Inicia sesión con GitHub</h3>
            <p>1) Abre GitHub para autorizar el acceso</p>
            <p>2) Cuando se te solicite, ingresa este código:</p>
            <div style="display:flex;align-items:center;gap:8px;margin:8px 0;">
                <code id="df-user-code" style="font-size:1.1rem;background:#f2f2f7;padding:6px 10px;border-radius:8px;">${data.user_code}</code>
                <button id="df-copy" style="background:#edae49;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;">Copiar</button>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button id="df-open" style="background:#edae49;color:#fff;border:none;padding:8px 14px;border-radius:10px;cursor:pointer;">Abrir GitHub</button>
                <button id="df-cancel" style="background:#d1495b;color:#fff;border:none;padding:8px 14px;border-radius:10px;cursor:pointer;">Cancelar</button>
            </div>
            <p id="df-status" style="color:#829399;margin-top:10px;">Esperando autorización…</p>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => { modal.remove(); };
    modal.querySelector('.close-btn').onclick = (e) => { e.stopPropagation(); close(); };
    modal.onclick = (e) => { if (e.target === modal) close(); };
    document.getElementById('df-cancel').onclick = close;
    document.getElementById('df-open').onclick = () => {
        window.open(data.verification_uri || 'https://github.com/login/device', '_blank');
    };
    document.getElementById('df-copy').onclick = async () => {
        try {
            await navigator.clipboard.writeText(data.user_code);
            setDfStatus('Código copiado al portapapeles');
        } catch (_) {
            setDfStatus('No se pudo copiar, cópialo manualmente');
        }
    };

    function setDfStatus(msg) {
        const el = document.getElementById('df-status');
        if (el) el.textContent = msg;
    }
}

async function pollForDeviceToken({ device_code, interval }) {
    let pollInterval = Math.max(5, interval || 5);
    const maxWaitMs = 10 * 60 * 1000; // 10 minutes
    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
        await new Promise(r => setTimeout(r, pollInterval * 1000));

        const params = new URLSearchParams();
        params.set('client_id', GITHUB_CLIENT_ID);
        params.set('device_code', device_code);
        params.set('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');

        const res = await fetch(GITHUB_DEVICE_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: params
        });

        if (!res.ok) {
            console.error('Error al solicitar token (HTTP):', res.status);
            continue;
        }

        const data = await res.json();
        if (data.error) {
            if (data.error === 'authorization_pending') {
                // keep polling
                continue;
            }
            if (data.error === 'slow_down') {
                pollInterval += 5;
                continue;
            }
            if (data.error === 'expired_token' || data.error === 'access_denied') {
                const statusEl = document.getElementById('df-status');
                if (statusEl) statusEl.textContent = 'Autorización cancelada o expirada';
                throw new Error(data.error);
            }
            console.error('Device flow error:', data);
            continue;
        }

        if (data.access_token) {
            userSession = { token: data.access_token, loginTime: Date.now() };
            localStorage.setItem('userSession', JSON.stringify(userSession));
            const modal = document.getElementById('auth-modal');
            if (modal) modal.remove();

            await fetchUserInfo(data.access_token);
            await findExistingGist();
            await loadTasksFromGist();
            updateLoginButton();
            showCalendar();
            scheduleBackgroundSync();
            return;
        }
    }

    const statusEl = document.getElementById('df-status');
    if (statusEl) statusEl.textContent = 'Tiempo de espera agotado';
    throw new Error('Device flow timeout');
}

// Search for an existing gist with our file to enable roaming across devices
async function findExistingGist() {
    if (!userSession || !userSession.token || userGistId) return;
    try {
        const res = await fetch('https://api.github.com/gists?per_page=100', {
            headers: {
                'Authorization': `token ${userSession.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (!res.ok) return;
        const gists = await res.json();
        const match = (gists || []).find(g => g.files && g.files['calendar-tasks.json']);
        if (match && match.id) {
            userGistId = match.id;
            localStorage.setItem('userGistId', userGistId);
            if (match.updated_at) {
                lastGistUpdatedAt = match.updated_at;
                localStorage.setItem('lastGistUpdatedAt', lastGistUpdatedAt);
            }
        }
    } catch (e) {
        console.error('Error discovering existing gist:', e);
    }
}

// Merge tasks objects combining arrays by id per date, remote precedence on same id
function mergeTasksById(localData, remoteData) {
    const result = { ...localData };
    const allDates = new Set([...Object.keys(localData || {}), ...Object.keys(remoteData || {})]);
    allDates.forEach(date => {
        const l = (localData && localData[date]) ? localData[date] : [];
        const r = (remoteData && remoteData[date]) ? remoteData[date] : [];
        const byId = new Map();
        l.forEach(t => byId.set(t.id, t));
        r.forEach(t => byId.set(t.id, { ...byId.get(t.id), ...t })); // remote overwrites same id
        const merged = Array.from(byId.values());
        if (merged.length > 0) {
            result[date] = merged;
        } else if (result[date]) {
            delete result[date];
        }
    });
    return result;
}

// Background sync: periodically pull from Gist if it changed
function scheduleBackgroundSync() {
    if (backgroundSyncTimer) return;
    // Only schedule Gist background pulls when using Gist mode
    if (userSession && userSession.jwt) return; // backend has server source of truth
    if (!userSession || !userSession.token || !userGistId) return;
    backgroundSyncTimer = setInterval(checkAndPullGist, currentSyncIntervalMs);
}

async function checkAndPullGist() {
    if (!userSession || !userSession.token || !userGistId) return;
    try {
        const res = await fetch(`https://api.github.com/gists/${userGistId}`, {
            headers: {
                'Authorization': `token ${userSession.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (!res.ok) {
            // Backoff on errors
            currentSyncIntervalMs = Math.min(maxSyncIntervalMs, currentSyncIntervalMs * 2);
            resetBackgroundTimer();
            return;
        }
        const gist = await res.json();
        const updated = gist.updated_at || null;
        if (!updated || updated === lastGistUpdatedAt) return; // no change
        const tasksFile = gist.files && gist.files['calendar-tasks.json'];
        if (tasksFile && tasksFile.content) {
            const remoteTasks = JSON.parse(tasksFile.content);
            const merged = mergeTasksById(tasks, remoteTasks);
            // Only update if something changed
            const localStr = JSON.stringify(tasks);
            const mergedStr = JSON.stringify(merged);
            if (localStr !== mergedStr) {
                tasks = merged;
                localStorage.setItem('calendarTasks', mergedStr);
                // Re-render active view
                if (calendarView && !calendarView.classList.contains('hidden')) {
                    renderCalendar();
                } else if (agendaView && !agendaView.classList.contains('hidden')) {
                    const m = (document.getElementById('month-filter') || {}).value || 'all';
                    const s = (document.getElementById('status-filter') || {}).value || 'all';
                    renderAgenda(m, s);
                }
            }
            lastGistUpdatedAt = updated;
            localStorage.setItem('lastGistUpdatedAt', lastGistUpdatedAt);
            // Success: reset backoff to base interval
            if (currentSyncIntervalMs !== baseSyncIntervalMs) {
                currentSyncIntervalMs = baseSyncIntervalMs;
                resetBackgroundTimer();
            }
        }
    } catch (e) {
        console.error('Background sync error:', e);
        // Backoff on exceptions
        currentSyncIntervalMs = Math.min(maxSyncIntervalMs, currentSyncIntervalMs * 2);
        resetBackgroundTimer();
    }
}

function resetBackgroundTimer() {
    if (backgroundSyncTimer) {
        clearInterval(backgroundSyncTimer);
        backgroundSyncTimer = null;
    }
    if (userSession && userSession.token && userGistId) {
        backgroundSyncTimer = setInterval(checkAndPullGist, currentSyncIntervalMs);
    }
}

// ========== PDF EXPORT FUNCTIONS ==========

// Show PDF export modal
function showPdfExportModal() {
    const modal = document.getElementById('pdf-export-modal');
    modal.classList.remove('hidden');
    
    // Set current month and year as default
    const now = new Date();
    document.getElementById('pdf-month-select').value = now.getMonth();
    document.getElementById('pdf-year-select').value = now.getFullYear();
    
    // Set up event listeners for radio buttons
    const radioButtons = document.querySelectorAll('input[name="export-type"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', toggleExportOptions);
    });
    
    // Set up close button
    const closeBtn = modal.querySelector('.close-btn');
    closeBtn.onclick = closePdfExportModal;
    
    // Close modal when clicking outside
    modal.onclick = function(event) {
        if (event.target === modal) {
            closePdfExportModal();
        }
    };
}

// Close PDF export modal
function closePdfExportModal() {
    const modal = document.getElementById('pdf-export-modal');
    modal.classList.add('hidden');
}

// Toggle export options based on selected radio button
function toggleExportOptions() {
    const selectedType = document.querySelector('input[name="export-type"]:checked').value;
    const monthSelection = document.getElementById('month-selection');
    const customRange = document.getElementById('custom-range');
    
    // Hide all options first
    monthSelection.classList.add('hidden');
    customRange.classList.add('hidden');
    
    // Show relevant option
    if (selectedType === 'month') {
        monthSelection.classList.remove('hidden');
    } else if (selectedType === 'custom') {
        customRange.classList.remove('hidden');
    }
}

// Main PDF generation function
function generatePDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Get export settings
        const exportType = document.querySelector('input[name="export-type"]:checked').value;
        const includeCompleted = document.getElementById('include-completed').checked;
        const includePending = document.getElementById('include-pending').checked;
        
        // Get filtered tasks based on export type
        let filteredTasks = getFilteredTasksForPDF(exportType, includeCompleted, includePending);
        
        if (filteredTasks.length === 0) {
            alert('No hay tareas que coincidan con los criterios seleccionados.');
            return;
        }
        
        // Generate PDF content
        generatePDFContent(doc, filteredTasks, exportType);
        
        // Generate filename based on export type
        const filename = generatePDFFilename(exportType);
        
        // Save the PDF
        doc.save(filename);
        
        // Close modal
        closePdfExportModal();
        
        // Show success message
        alert(`PDF generado exitosamente: ${filename}`);
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error al generar el PDF. Por favor, inténtalo de nuevo.');
    }
}

// Get filtered tasks based on export type and options
function getFilteredTasksForPDF(exportType, includeCompleted, includePending) {
    // Get all tasks and flatten them
    let allTasks = Object.entries(tasks).flatMap(([date, taskList]) =>
        taskList.map(task => ({ ...task, date: date === 'undated' ? null : date }))
    );
    
    // Filter by completion status
    allTasks = allTasks.filter(task => {
        if (task.completed && !includeCompleted) return false;
        if (!task.completed && !includePending) return false;
        return true;
    });
    
    // Filter by date range based on export type
    if (exportType === 'month') {
        const selectedMonth = parseInt(document.getElementById('pdf-month-select').value);
        const selectedYear = parseInt(document.getElementById('pdf-year-select').value);
        
        allTasks = allTasks.filter(task => {
            if (!task.date) return false;
            const taskDate = new Date(task.date + 'T00:00:00');
            return taskDate.getMonth() === selectedMonth && taskDate.getFullYear() === selectedYear;
        });
    } else if (exportType === 'custom') {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        if (!startDate || !endDate) {
            alert('Por favor, selecciona ambas fechas para el rango personalizado.');
            return [];
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            alert('La fecha de inicio debe ser anterior o igual a la fecha de fin.');
            return [];
        }
        
        allTasks = allTasks.filter(task => {
            if (!task.date) return false;
            const taskDate = new Date(task.date + 'T00:00:00');
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T23:59:59');
            return taskDate >= start && taskDate <= end;
        });
    }
    
    // Sort tasks by date (undated tasks first, then by date)
    allTasks.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return -1;
        if (!b.date) return 1;
        
        const dateA = new Date(a.date + 'T00:00:00');
        const dateB = new Date(b.date + 'T00:00:00');
        
        if (dateA.getTime() === dateB.getTime()) {
            // If same date, sort by time if available
            if (a.time && b.time) {
                return a.time.localeCompare(b.time);
            }
            if (a.time && !b.time) return -1;
            if (!a.time && b.time) return 1;
            return 0;
        }
        
        return dateA - dateB;
    });
    
    return allTasks;
}

// Generate PDF content
function generatePDFContent(doc, tasks, exportType) {
    // Set up fonts and colors
    doc.setFont('helvetica');
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(237, 174, 73); // Calendar10 brand color
    doc.text('Calendar10 - Reporte de Tareas', 20, 25);
    
    // Subtitle based on export type
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    let subtitle = '';
    if (exportType === 'all') {
        subtitle = 'Todas las tareas ordenadas por fecha';
    } else if (exportType === 'month') {
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const selectedMonth = parseInt(document.getElementById('pdf-month-select').value);
        const selectedYear = parseInt(document.getElementById('pdf-year-select').value);
        subtitle = `Tareas de ${monthNames[selectedMonth]} ${selectedYear}`;
    } else if (exportType === 'custom') {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        subtitle = `Tareas del ${formatDateForDisplay(startDate)} al ${formatDateForDisplay(endDate)}`;
    }
    doc.text(subtitle, 20, 35);
    
    // Generation date
    const now = new Date();
    doc.text(`Generado el: ${now.toLocaleDateString('es-ES')} a las ${now.toLocaleTimeString('es-ES')}`, 20, 45);
    
    // Table headers
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    
    let yPosition = 60;
    const leftMargin = 20;
    const colWidths = [80, 35, 25, 30]; // Title, Date, Time, Status
    const colPositions = [leftMargin, leftMargin + colWidths[0], leftMargin + colWidths[0] + colWidths[1], leftMargin + colWidths[0] + colWidths[1] + colWidths[2]];
    
    // Draw table header
    doc.rect(leftMargin, yPosition - 5, colWidths.reduce((a, b) => a + b, 0), 10);
    doc.text('Título de la Tarea', colPositions[0] + 2, yPosition);
    doc.text('Fecha', colPositions[1] + 2, yPosition);
    doc.text('Hora', colPositions[2] + 2, yPosition);
    doc.text('Estado', colPositions[3] + 2, yPosition);
    
    yPosition += 10;
    doc.setFont('helvetica', 'normal');
    
    // Add tasks to table
    tasks.forEach((task, index) => {
        // Check if we need a new page
        if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
            
            // Redraw header on new page
            doc.setFont('helvetica', 'bold');
            doc.rect(leftMargin, yPosition - 5, colWidths.reduce((a, b) => a + b, 0), 10);
            doc.text('Título de la Tarea', colPositions[0] + 2, yPosition);
            doc.text('Fecha', colPositions[1] + 2, yPosition);
            doc.text('Hora', colPositions[2] + 2, yPosition);
            doc.text('Estado', colPositions[3] + 2, yPosition);
            yPosition += 10;
            doc.setFont('helvetica', 'normal');
        }
        
        // Alternate row colors
        if (index % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(leftMargin, yPosition - 5, colWidths.reduce((a, b) => a + b, 0), 8, 'F');
        }
        
        // Task title (truncate if too long)
        let title = task.title;
        if (title.length > 35) {
            title = title.substring(0, 32) + '...';
        }
        doc.text(title, colPositions[0] + 2, yPosition);
        
        // Date
        const dateText = task.date ? formatDateForDisplay(task.date) : 'Sin fecha';
        doc.text(dateText, colPositions[1] + 2, yPosition);
        
        // Time
        const timeText = task.time || '-';
        doc.text(timeText, colPositions[2] + 2, yPosition);
        
        // Status
        const statusText = task.completed ? '✓ Completada' : '○ Pendiente';
        doc.setTextColor(task.completed ? 76 : 255, task.completed ? 175 : 152, task.completed ? 80 : 0);
        doc.text(statusText, colPositions[3] + 2, yPosition);
        doc.setTextColor(0, 0, 0);
        
        yPosition += 8;
    });
    
    // Footer with summary
    yPosition += 10;
    if (yPosition > 260) {
        doc.addPage();
        yPosition = 20;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen:', leftMargin, yPosition);
    yPosition += 8;
    
    doc.setFont('helvetica', 'normal');
    const completedCount = tasks.filter(t => t.completed).length;
    const pendingCount = tasks.filter(t => !t.completed).length;
    
    doc.text(`Total de tareas: ${tasks.length}`, leftMargin, yPosition);
    yPosition += 6;
    doc.setTextColor(76, 175, 80);
    doc.text(`Tareas completadas: ${completedCount}`, leftMargin, yPosition);
    yPosition += 6;
    doc.setTextColor(255, 152, 0);
    doc.text(`Tareas pendientes: ${pendingCount}`, leftMargin, yPosition);
    
    // Footer
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text('Generado por Calendar10 - skillparty', leftMargin, 285);
}

// Generate filename based on export type
function generatePDFFilename(exportType) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    if (exportType === 'all') {
        return `Calendar10_Todas_las_Tareas_${dateStr}.pdf`;
    } else if (exportType === 'month') {
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const selectedMonth = parseInt(document.getElementById('pdf-month-select').value);
        const selectedYear = parseInt(document.getElementById('pdf-year-select').value);
        return `Calendar10_${monthNames[selectedMonth]}_${selectedYear}_${dateStr}.pdf`;
    } else if (exportType === 'custom') {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        return `Calendar10_${startDate}_a_${endDate}_${dateStr}.pdf`;
    }
    
    return `Calendar10_Tareas_${dateStr}.pdf`;
}