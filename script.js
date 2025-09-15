// Global variables
let currentDate = new Date();
let tasks = JSON.parse(localStorage.getItem('calendarTasks')) || {};
let userSession = JSON.parse(localStorage.getItem('userSession')) || null;
let userGistId = localStorage.getItem('userGistId') || null;

// GitHub OAuth constants
const GITHUB_CLIENT_ID = 'Ov23liyk7oqj7OI75MfO';
const GITHUB_REDIRECT_URI = 'https://skillparty.github.io/calendario';
const GITHUB_AUTH_URL = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=user,gist&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&response_type=token`;

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

    handleOAuthCallback();
    updateLoginButton();
    showCalendar(); // Default view
    checkNotifications();
    setInterval(checkNotifications, 60000); // Check every minute

    console.log('App initialized');

    // Add a global test function for debugging
    window.testLoginUI = function() {
        console.log('🧪 Testing login UI with mock data...');
        userSession = {
            token: 'test-token-' + Date.now(),
            loginTime: Date.now(),
            user: {
                login: 'usuario-demo',
                name: 'Usuario de Prueba',
                avatar_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2MjY0NjciLz4KPHBhdGggZD0iTTIwIDIwaC00djRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNFoiIGZpbGw9IiNmZmYiLz4KPHBhdGggZD0iTTIyIDI0SDR2LTJjMC0yLjIgMS44LTQgNC00aDEwdjRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNFoiIGZpbGw9IiNmZmYiLz4KPC9zdmc+'
            }
        };
        localStorage.setItem('userSession', JSON.stringify(userSession));
        updateLoginButton();
        console.log('✅ Test login UI applied - You should now see avatar, name, logout button, and online indicator');
    };

    window.clearTestLogin = function() {
        console.log('🧹 Clearing test login...');
        userSession = null;
        localStorage.removeItem('userSession');
        updateLoginButton();
        console.log('✅ Test login cleared');
    };

    // Force show login UI for testing
    window.forceShowLoginUI = function() {
        console.log('🔧 Forcing login UI update...');
        const loginBtn = document.getElementById('login-btn');
        const userInfo = document.getElementById('user-info');
        const userAvatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');
        const logoutBtn = document.getElementById('logout-btn');

        console.log('Current DOM state:', {
            loginBtn: loginBtn?.style.display,
            userInfo: userInfo?.style.display,
            userAvatar: userAvatar?.style.display,
            userName: userName?.textContent,
            logoutBtn: logoutBtn?.style.display
        });

        // Force show user info
        if (loginBtn) loginBtn.style.display = 'none';
        if (userInfo) userInfo.style.display = 'flex';
        if (userAvatar) {
            userAvatar.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2MjY0NjciLz4KPHBhdGggZD0iTTIwIDIwaC00djRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNFoiIGZpbGw9IiNmZmYiLz4KPHBhdGggZD0iTTIyIDI0SDR2LTJjMC0yLjIgMS44LTQgNC00aDEwdjRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNFoiIGZpbGw9IiNmZmYiLz4KPC9zdmc+';
            userAvatar.style.display = 'block';
        }
        if (userName) userName.textContent = 'Usuario de Prueba';
        if (logoutBtn) {
            logoutBtn.style.display = 'inline-block';
            logoutBtn.onclick = function() {
                console.log('Logout clicked');
                window.forceHideLoginUI();
            };
        }

        // Add online indicator
        const userStatus = document.getElementById('user-status');
        if (userStatus && !userStatus.querySelector('.online-indicator')) {
            const onlineIndicator = document.createElement('span');
            onlineIndicator.className = 'online-indicator';
            onlineIndicator.textContent = '●';
            onlineIndicator.title = 'En línea';
            if (userInfo) userInfo.appendChild(onlineIndicator);
        }

        console.log('✅ Forced login UI shown');
    };

    window.forceHideLoginUI = function() {
        console.log('🔧 Forcing login UI hide...');
        const loginBtn = document.getElementById('login-btn');
        const userInfo = document.getElementById('user-info');

        if (loginBtn) loginBtn.style.display = 'flex';
        if (userInfo) userInfo.style.display = 'none';

        // Remove online indicator
        const onlineIndicator = document.querySelector('.online-indicator');
        if (onlineIndicator) onlineIndicator.remove();

        console.log('✅ Forced login UI hidden');
    };
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
            <div class="task-info">
                <span>${task.title} - ${formattedDate}</span>
                <div class="task-buttons">
                    <button onclick="toggleTask('${task.id}'); renderAgenda('${filterMonth}', '${filterStatus}')">${task.completed ? 'Desmarcar' : 'Marcar como hecho'}</button>
                    <button onclick="deleteTask('${task.id}')" class="delete-btn">🗑️ Eliminar</button>
                </div>
            </div>
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

        saveTasks();

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
    console.log('🔍 handleOAuthCallback called with hash:', hash);

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
                }
            } catch (e) {
                console.error('❌ Error parsing stored session:', e);
                localStorage.removeItem('userSession');
            }
        }
    }
}

// Fetch user info from GitHub
async function fetchUserInfo(token) {
    console.log('fetchUserInfo called with token');
    try {
        console.log('Making API call to GitHub...');
        const response = await fetch('https://api.github.com/user', {
            headers: { Authorization: `token ${token}` }
        });

        console.log('GitHub API response status:', response.status);

        if (!response.ok) {
            console.error('GitHub API error:', response.status, response.statusText);
            return;
        }

        const user = await response.json();
        console.log('GitHub user data received:', user);

        userSession.user = user;
        localStorage.setItem('userSession', JSON.stringify(userSession));
        console.log('User session updated with user data');

        // Load tasks from Gist after successful login
        await loadTasksFromGist();

        console.log('Calling updateLoginButton...');
        updateLoginButton();

        // Refresh the UI to show loaded data
        showCalendar();
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
            console.log('🙈 User info hidden');
        }

        // Remove online indicator if exists
        const onlineIndicator = document.querySelector('.online-indicator');
        if (onlineIndicator) {
            onlineIndicator.remove();
        }
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