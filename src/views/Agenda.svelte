<script lang="ts">
    import {
        tasksStore,
        filtersStore,
        setFilters,
        notifyTasksUpdated,
        requestOpenTaskModal,
    } from "../store/state";
    import { icons, getIcon } from "../components/icons";
    import { escapeHtml } from "../utils/helpers";
    import { confirmDeleteTask, toggleTask } from "../utils/taskActions";
    import TaskCard from "../components/TaskCard.svelte";
    import { isLoggedInWithBackend, loadTasksIntoState } from "../services/api";
    import { showToast, showSyncToast } from "../utils/UIFeedback";
    import { showPdfExportModal } from "./pdf.js";

    let agendaSearchTerm = "";
    let syncing = false;

    $: filterMonth = $filtersStore.month;
    $: filterStatus = $filtersStore.status;
    $: filterPriority = $filtersStore.priority;

    $: allFlatTasks = Object.entries($tasksStore)
        .flatMap(([date, list]) =>
            (list || []).map((t) => ({
                ...t,
                date: date === "undated" ? null : date,
            })),
        )
        .sort((a, b) => {
            if (!a.date && !b.date) return 0;
            if (!a.date) return -1;
            if (!b.date) return 1;
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

    $: filteredTasks = allFlatTasks.filter((task) => {
        // Search Term
        if (agendaSearchTerm) {
            const term = agendaSearchTerm.trim().toLowerCase();
            const titleMatch = task.title.toLowerCase().includes(term);
            const descMatch = (task.description || "")
                .toLowerCase()
                .includes(term);
            if (!titleMatch && !descMatch) return false;
        }

        // Month filter
        if (filterMonth !== "all" && task.date) {
            const taskDate = new Date(task.date + "T00:00:00");
            if (taskDate.getMonth() !== parseInt(filterMonth)) return false;
        }

        // Status Filter
        if (filterStatus !== "all") {
            if (task.completed !== (filterStatus === "completed")) return false;
        }

        // Priority filter
        if (filterPriority !== "all") {
            if (task.priority !== parseInt(filterPriority)) return false;
        }

        return true;
    });

    $: statsTotal = allFlatTasks.length;
    $: statsCompleted = allFlatTasks.filter((t) => t.completed).length;

    $: undatedTasks = filteredTasks.filter((t) => !t.date);
    $: tasksByDate = filteredTasks
        .filter((t) => t.date)
        .reduce(
            (acc, task) => {
                if (task.date) {
                    if (!acc[task.date]) acc[task.date] = [];
                    acc[task.date].push(task);
                }
                return acc;
            },
            {} as Record<string, typeof filteredTasks>,
        );

    $: dateKeys = Object.keys(tasksByDate).sort();

    function getColorByDay(dateString: string) {
        const date = new Date(dateString + "T00:00:00");
        const dayOfWeek = date.getDay();
        const dayColors: Record<
            number,
            { bg: string; border: string; text: string }
        > = {
            0: {
                bg: "var(--day-sun-bg)",
                border: "var(--day-sun-border)",
                text: "var(--day-sun-text)",
            },
            1: {
                bg: "var(--day-mon-bg)",
                border: "var(--day-mon-border)",
                text: "var(--day-mon-text)",
            },
            2: {
                bg: "var(--day-tue-bg)",
                border: "var(--day-tue-border)",
                text: "var(--day-tue-text)",
            },
            3: {
                bg: "var(--day-wed-bg)",
                border: "var(--day-wed-border)",
                text: "var(--day-wed-text)",
            },
            4: {
                bg: "var(--day-thu-bg)",
                border: "var(--day-thu-border)",
                text: "var(--day-thu-text)",
            },
            5: {
                bg: "var(--day-fri-bg)",
                border: "var(--day-fri-border)",
                text: "var(--day-fri-text)",
            },
            6: {
                bg: "var(--day-sat-bg)",
                border: "var(--day-sat-border)",
                text: "var(--day-sat-text)",
            },
        };
        return dayColors[dayOfWeek];
    }

    function getDateLabel(dateString: string) {
        const dateObj = new Date(dateString + "T00:00:00");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (dateObj.toDateString() === today.toDateString()) return "Hoy";
        if (dateObj.toDateString() === tomorrow.toDateString()) return "Mañana";

        return dateObj.toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }

    function handleFilterChange() {
        setFilters(filterMonth, filterStatus, filterPriority);
    }

    function handleManualSync() {
        syncing = true;
        if (!isLoggedInWithBackend()) {
            showToast("Inicia sesión para sincronizar", {
                type: "warning",
            });
            syncing = false;
            return;
        }
        showSyncToast("Sincronizando...");
        loadTasksIntoState()
            .then(() => {
                notifyTasksUpdated();
                showSyncToast("Sincronizado");
            })
            .catch(() => {
                showToast("Error al sincronizar", { type: "error" });
            })
            .finally(() => (syncing = false));
    }

    function handlePdfExport() {
        showPdfExportModal();
    }

    function handleTestNotification() {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Test de Notificación", {
                body: "Las notificaciones funcionan correctamente.",
            });
        } else if (
            "Notification" in window &&
            Notification.permission !== "denied"
        ) {
            Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                    new Notification("Test de Notificación", {
                        body: "Las notificaciones funcionan correctamente.",
                    });
                }
            });
        }
    }

    function handleHardReset() {
        const msg =
            "¿Problemas de sincronización?\n\nEsto borrará los datos LOCALES y descargará todo del servidor nuevamente.\n\n¿Continuar?";
        if (confirm(msg)) {
            try {
                localStorage.removeItem("calendarTasks");
                location.reload();
            } catch (e) {
                alert("Error al limpiar caché: " + e);
            }
        }
    }

    function openTaskModal(task: any = null) {
        requestOpenTaskModal(task?.date || null, task);
    }

    function handleToggle(taskId: string) {
        toggleTask(taskId);
    }

    function handleDelete(taskId: string, title: string) {
        if (window.confirm("¿Eliminar esta tarea?")) {
            confirmDeleteTask(taskId, title);
        }
    }
</script>

<div class="agenda-container animate-entry">
    <header class="agenda-toolbar animate-entry">
        <div class="toolbar-brand">
            <h2 class="toolbar-title">
                {@html getIcon("clipboard", "agenda-icon")}
                <span class="title-text">Agenda</span>
            </h2>
        </div>

        <div class="toolbar-actions">
            <div class="toolbar-search">
                <input
                    type="text"
                    placeholder="Buscar..."
                    class="search-input"
                    bind:value={agendaSearchTerm}
                />
                {@html getIcon("search", "search-icon")}
            </div>

            <div class="toolbar-filters">
                <button
                    type="button"
                    class="toolbar-btn-icon"
                    class:spinning={syncing}
                    title="Sincronizar ahora"
                    on:click={handleManualSync}
                >
                    {@html icons.refresh ||
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>'}
                </button>

                <button
                    type="button"
                    class="toolbar-btn-icon"
                    title="Resetear datos (Solucionar problemas)"
                    style="color: var(--error);"
                    on:click={handleHardReset}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        ><path d="M3 6h18" /><path
                            d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
                        /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg
                    >
                </button>

                <select
                    class="toolbar-select"
                    title="Filtrar por Mes"
                    bind:value={filterMonth}
                    on:change={handleFilterChange}
                >
                    <option value="all">Mes: Todos</option>
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

                <select
                    class="toolbar-select"
                    title="Filtrar por Estado"
                    bind:value={filterStatus}
                    on:change={handleFilterChange}
                >
                    <option value="all">Estado: Todos</option>
                    <option value="pending">Pendientes</option>
                    <option value="completed">Completadas</option>
                </select>

                <select
                    class="toolbar-select"
                    title="Filtrar por Prioridad"
                    bind:value={filterPriority}
                    on:change={handleFilterChange}
                >
                    <option value="all">Prioridad: Todas</option>
                    <option value="1">Alta</option>
                    <option value="2">Media</option>
                    <option value="3">Baja</option>
                </select>
            </div>

            <button
                type="button"
                class="toolbar-btn-add"
                on:click|stopPropagation={() => openTaskModal()}
            >
                {@html getIcon("plus", "btn-icon")}
                <span>Nueva Tarea</span>
            </button>
        </div>
    </header>

    <button
        type="button"
        class="fab-add-task"
        aria-label="Nueva Tarea"
        on:click|stopPropagation={() => openTaskModal()}
    >
        <span class="icon">{@html icons.plus}</span>
    </button>

    <main class="agenda-main-content">
        <div class="content-grid">
            <section class="tasks-section">
                <div class="task-list-container">
                    <ul class="task-list">
                        {#if filteredTasks.length === 0}
                            <div
                                class="empty-state"
                                style="min-height: 120px; padding: 1.5rem;"
                            >
                                <div
                                    class="empty-state-icon"
                                    style="font-size: 2.5rem;"
                                >
                                    {@html icons.inbox}
                                </div>
                                <h3 class="empty-state-title">
                                    No hay tareas que mostrar
                                </h3>
                                <p class="empty-state-text">
                                    {filterMonth !== "all" ||
                                    filterStatus !== "all" ||
                                    filterPriority !== "all"
                                        ? "No se encontraron tareas con los filtros actuales. Prueba ajustando los filtros o crea una nueva tarea."
                                        : "¡Comienza agregando tu primera tarea del día!"}
                                </p>
                                <button
                                    type="button"
                                    class="btn-primary empty-state-btn"
                                    on:click={() => openTaskModal()}
                                    style="margin-top: 1rem;"
                                >
                                    {@html getIcon("plus", "btn-icon")}
                                    <span>Agregar Primera Tarea</span>
                                </button>
                            </div>
                        {:else}
                            {#if undatedTasks.length > 0}
                                <li class="task-date-group">
                                    <div class="date-group-header">
                                        {@html getIcon(
                                            "pin",
                                            "date-group-icon",
                                        )}
                                        <h3 class="date-group-title">
                                            Tareas sin fecha
                                        </h3>
                                        <span class="date-group-count"
                                            >{undatedTasks.length}</span
                                        >
                                    </div>
                                    <ul class="date-group-tasks">
                                        {#each undatedTasks as task}
                                            <TaskCard
                                                {task}
                                                on:toggle={(e) =>
                                                    handleToggle(e.detail)}
                                                on:edit={(e) =>
                                                    openTaskModal(e.detail)}
                                                on:delete={(e) =>
                                                    handleDelete(
                                                        e.detail,
                                                        task.title,
                                                    )}
                                            />
                                        {/each}
                                    </ul>
                                </li>
                            {/if}

                            {#each dateKeys as date}
                                {@const dateTasks = tasksByDate[date]}
                                {@const dayColors = getColorByDay(date)}
                                <li class="task-date-group">
                                    <div
                                        class="date-group-header"
                                        style="border-left: 4px solid {dayColors.border}; background-color: {dayColors.bg};"
                                    >
                                        {@html getDateLabel(date) === "Hoy"
                                            ? getIcon("pin", "date-group-icon")
                                            : getIcon(
                                                  "calendar",
                                                  "date-group-icon",
                                              )}
                                        <h3 class="date-group-title">
                                            {getDateLabel(date)}
                                        </h3>
                                        <span class="date-group-count"
                                            >{dateTasks.length}</span
                                        >
                                    </div>
                                    <ul class="date-group-tasks">
                                        {#each dateTasks as task}
                                            <TaskCard
                                                {task}
                                                on:toggle={(e) =>
                                                    handleToggle(e.detail)}
                                                on:edit={(e) =>
                                                    openTaskModal(e.detail)}
                                                on:delete={(e) =>
                                                    handleDelete(
                                                        e.detail,
                                                        task.title,
                                                    )}
                                            />
                                        {/each}
                                    </ul>
                                </li>
                            {/each}
                        {/if}
                    </ul>
                </div>
            </section>

            <aside class="sidebar-section">
                <div class="sidebar-content">
                    <div class="sidebar-block quick-actions-block">
                        <h3 class="sidebar-title">
                            {@html getIcon("zap", "sidebar-icon")}
                            <span>Acciones Rápidas</span>
                        </h3>
                        <div class="quick-actions">
                            <button
                                type="button"
                                class="btn-action primary"
                                on:click|stopPropagation={() => openTaskModal()}
                            >
                                {@html getIcon("plus", "btn-icon")}
                                <span>Nueva Tarea</span>
                            </button>
                            <button
                                type="button"
                                class="btn-action secondary"
                                on:click|stopPropagation={handlePdfExport}
                            >
                                {@html getIcon("fileText", "btn-icon")}
                                <span>Exportar PDF</span>
                            </button>
                            <button
                                type="button"
                                class="btn-action secondary"
                                on:click={handleTestNotification}
                            >
                                {@html getIcon("bell", "btn-icon")}
                                <span>Test Notificaciones</span>
                            </button>
                        </div>
                    </div>

                    <div class="sidebar-block stats-block">
                        <h3 class="sidebar-title">
                            {@html getIcon("barChart", "sidebar-icon")}
                            <span>Resumen</span>
                        </h3>
                        <div class="stats-overview">
                            <button
                                type="button"
                                class="stat-item total {filterStatus === 'all'
                                    ? 'active'
                                    : ''}"
                                on:click={() => {
                                    filterStatus = "all";
                                    handleFilterChange();
                                }}
                                title="Mostrar todas"
                            >
                                <div class="stat-value">{statsTotal}</div>
                                <div class="stat-label">Total</div>
                                <div class="stat-progress">
                                    <div
                                        class="progress-bar"
                                        style="width: 100%"
                                    ></div>
                                </div>
                            </button>
                            <button
                                type="button"
                                class="stat-item completed {filterStatus ===
                                'completed'
                                    ? 'active'
                                    : ''}"
                                on:click={() => {
                                    filterStatus = "completed";
                                    handleFilterChange();
                                }}
                                title="Mostrar completadas"
                            >
                                <div class="stat-value">{statsCompleted}</div>
                                <div class="stat-label">Completadas</div>
                                <div class="stat-progress">
                                    <div
                                        class="progress-bar"
                                        style="width: {statsTotal > 0
                                            ? (statsCompleted / statsTotal) *
                                              100
                                            : 0}%"
                                    ></div>
                                </div>
                            </button>
                            <button
                                type="button"
                                class="stat-item pending {filterStatus ===
                                'pending'
                                    ? 'active'
                                    : ''}"
                                on:click={() => {
                                    filterStatus = "pending";
                                    handleFilterChange();
                                }}
                                title="Mostrar pendientes"
                            >
                                <div class="stat-value">
                                    {statsTotal - statsCompleted}
                                </div>
                                <div class="stat-label">Pendientes</div>
                                <div class="stat-progress">
                                    <div
                                        class="progress-bar"
                                        style="width: {statsTotal > 0
                                            ? ((statsTotal - statsCompleted) /
                                                  statsTotal) *
                                              100
                                            : 0}%"
                                    ></div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    </main>
</div>
