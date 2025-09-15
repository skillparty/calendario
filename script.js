// Global variables
let currentDate = new Date();
let tasks = JSON.parse(localStorage.getItem('calendarTasks')) || {};
let userSession = JSON.parse(localStorage.getItem('userSession')) || null;
let userGistId = localStorage.getItem('userGistId') || null;

// GitHub OAuth constants
const GITHUB_CLIENT_ID = 'Ov23liyk7oqj7OI75MfO';
const GITHUB_REDIRECT_URI = 'https://skillparty.github.io/calendario';
const GITHUB_AUTH_URL = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=user,gist&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}`;

// DOM elements
const calendarBtn = document.getElementById('calendar-btn');
const agendaBtn = document.getElementById('agenda-btn');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const calendarView = document.getElementById('calendar-view');
const agendaView = document.getElementById('agenda-view');

// Event listeners
calendarBtn.addEventListener('click', showCalendar);
agendaBtn.addEventListener('click', showAgenda);
loginBtn.addEventListener('click', handleLogin);
logoutBtn.addEventListener('click', handleLogout);

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    handleOAuthCallback();
    updateLoginButton();
    showCalendar(); // Default view
    checkNotifications();
    setInterval(checkNotifications, 60000); // Check every minute
});

// Show calendar view
function showCalendar() {
    calendarView.classList.remove('hidden');
    agendaView.classList.add('hidden');
    renderCalendar();
}

// Show agenda view
function showAgenda() {
    agendaView.classList.remove('hidden');
    calendarView.classList.add('hidden');

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
        <div class="calendar-header">
            <button id="prev-month"><</button>
            <h2>${getMonthName(month)} ${year}</h2>
            <button id="next-month">></button>
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

    for (let date = new Date(startDate); date <= lastDay; date.setDate(date.getDate() + 1)) {
        const dayClass = date.getMonth() === month ? 'day' : 'day other-month';
        const todayClass = isToday(date) ? ' today' : '';
        const dateKey = formatDate(date);
        const pendingTasks = tasks[dateKey] ? tasks[dateKey].filter(task => !task.completed).length : 0;
        const completedTasks = tasks[dateKey] ? tasks[dateKey].filter(task => task.completed).length : 0;
        const totalTasks = pendingTasks + completedTasks;
        html += `<div class="${dayClass}${todayClass}" data-date="${dateKey}">
            <div class="day-content">
                <span class="day-number">${date.getDate()}</span>
                ${totalTasks > 0 ? `<small class="task-count">${pendingTasks} pendiente(s)</small>` : ''}
                <button class="day-add-btn" data-date="${dateKey}" title="Agregar recordatorio">+</button>
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

    // Add event listeners for day clicks (show task list)
    document.querySelectorAll('.day:not(.other-month)').forEach(day => {
        const dayContent = day.querySelector('.day-content');
        if (dayContent) {
            dayContent.addEventListener('click', (e) => {
                // Only trigger if not clicking on the + button
                if (!e.target.classList.contains('day-add-btn')) {
                    e.stopPropagation();
                    const date = day.dataset.date;
                    showDayTasks(date);
                }
            });
        }
    });

    // Add event listeners for + buttons (add task)
    document.querySelectorAll('.day-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the day click
            const date = btn.dataset.date;
            addTask(date);
        });
    });
}

// Render agenda
function renderAgenda(filterMonth = 'all', filterStatus = 'all') {
    let html = `
        <h2>Agenda</h2>
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
        <ul>
    `;

    let allTasks = Object.entries(tasks).flatMap(([date, taskList]) =>
        taskList.map(task => ({ ...task, date }))
    ).sort((a, b) => new Date(a.date) - new Date(b.date));

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
        const formattedDate = formatDateForDisplay(task.date);
        html += `<li class="task${completedClass}">
            <span>${task.title} - ${formattedDate}</span>
            <button onclick="toggleTask('${task.id}'); renderAgenda('${filterMonth}', '${filterStatus}')">${task.completed ? 'Desmarcar' : 'Marcar como hecho'}</button>
        </li>`;
    });
    html += '</ul>';
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

// Add task
function addTask(date) {
    // Create a custom input dialog instead of using browser prompt
    const title = prompt('Ingrese el título del recordatorio:');
    if (title && title.trim()) {
        const task = {
            id: Date.now().toString(),
            title: title.trim(),
            date,
            completed: false,
            isReminder: true
        };
        if (!tasks[date]) tasks[date] = [];
        tasks[date].push(task);
        saveTasks();
        renderCalendar();

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
    saveTasks();

    // Get current filter values and re-render agenda with them
    const monthFilter = document.getElementById('month-filter');
    const statusFilter = document.getElementById('status-filter');
    const currentMonthFilter = monthFilter ? monthFilter.value : 'all';
    const currentStatusFilter = statusFilter ? statusFilter.value : 'all';

    renderAgenda(currentMonthFilter, currentStatusFilter);
    renderCalendar(); // Update calendar to reflect new task count
}

// Save tasks to localStorage and sync to GitHub Gist
async function saveTasks() {
    localStorage.setItem('calendarTasks', JSON.stringify(tasks));

    // Sync to GitHub Gist if user is logged in
    if (userSession && userSession.token) {
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
                // Merge remote tasks with local tasks (remote takes precedence for conflicts)
                tasks = { ...tasks, ...remoteTasks };
                localStorage.setItem('calendarTasks', JSON.stringify(tasks));
                return true;
            }
        }
    } catch (error) {
        console.error('Error loading tasks from Gist:', error);
    }

    return false;
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
    if (hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        if (token) {
            userSession = { token, loginTime: Date.now() };
            localStorage.setItem('userSession', JSON.stringify(userSession));
            window.location.hash = ''; // Clean URL
            fetchUserInfo(token);
        }
    }
}

// Fetch user info from GitHub
async function fetchUserInfo(token) {
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: { Authorization: `token ${token}` }
        });
        const user = await response.json();
        userSession.user = user;
        localStorage.setItem('userSession', JSON.stringify(userSession));

        // Load tasks from Gist after successful login
        await loadTasksFromGist();

        updateLoginButton();
        // Refresh the UI to show loaded data
        showCalendar();
    } catch (error) {
        console.error('Error fetching user info:', error);
    }
}

// Update login button
function updateLoginButton() {
    if (userSession && userSession.user) {
        // User is logged in - show user info
        loginBtn.style.display = 'none';
        userInfo.style.display = 'flex';
        userInfo.classList.add('show');

        if (userSession.user.avatar_url) {
            userAvatar.src = userSession.user.avatar_url;
            userAvatar.style.display = 'block';
        } else {
            userAvatar.style.display = 'none';
        }

        userName.textContent = userSession.user.name || userSession.user.login;
        console.log('User logged in:', userSession.user.login);
    } else {
        // User is not logged in - show login button
        loginBtn.style.display = 'flex';
        userInfo.style.display = 'none';
        userInfo.classList.remove('show');
        userAvatar.style.display = 'none';
        userName.textContent = '';
        console.log('User logged out');
    }
}

// Handle login
function handleLogin() {
    console.log('Attempting GitHub login with URL:', GITHUB_AUTH_URL);
    console.log('Current location origin:', window.location.origin);
    window.location.href = GITHUB_AUTH_URL;
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
                <strong>${task.title}</strong>
                <button onclick="toggleTask('${task.id}'); setTimeout(() => showDayTasks('${date}'), 100)">
                    ${task.completed ? 'Desmarcar' : 'Marcar como hecho'}
                </button>
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