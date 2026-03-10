<script lang="ts">
    import { onMount } from "svelte";
    import { groupsStore, userSessionStore, setGroups } from "../store/state";
    import { API_BASE_URL } from "../services/api";
    import { showToast } from "../utils/UIFeedback";
    import type { Group, GroupTask } from "../types";

    let selectedGroupId: number | null = null;
    let loadingGroups = false;
    let loadingTasks = false;

    let currentDate = new Date();
    let groupTasks: GroupTask[] = [];

    const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    $: jwt = $userSessionStore?.jwt || $userSessionStore?.token;
    $: isLoggedIn = !!jwt;
    $: groups = ($groupsStore ?? []) as Group[];

    $: year = currentDate.getFullYear();
    $: month = currentDate.getMonth();

    $: monthLabel = new Date(year, month, 1).toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
    });

    $: tasksByDate = groupTasks.reduce(
        (acc, task) => {
            const dateKey = (task.date || "").slice(0, 10);
            if (!dateKey) return acc;
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(task);
            return acc;
        },
        {} as Record<string, GroupTask[]>,
    );

    $: daysInGrid = buildMonthGrid(year, month);

    function formatDateLocal(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    function buildMonthGrid(y: number, m: number) {
        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0);
        const start = new Date(firstDay);
        start.setDate(start.getDate() - firstDay.getDay());

        const end = new Date(lastDay);
        end.setDate(end.getDate() + (6 - lastDay.getDay()));

        const days: Array<{
            date: Date;
            dateKey: string;
            isCurrentMonth: boolean;
            taskCount: number;
        }> = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateKey = formatDateLocal(d);
            days.push({
                date: new Date(d),
                dateKey,
                isCurrentMonth: d.getMonth() === m,
                taskCount: (tasksByDate[dateKey] || []).length,
            });
        }

        return days;
    }

    async function apiFetch(path: string, options: RequestInit = {}) {
        const res = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${jwt}`,
                ...(options.headers || {}),
            },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Error de red");
        return data;
    }

    async function loadGroupsIfNeeded() {
        if (!isLoggedIn) return;
        if (groups.length > 0) {
            if (!selectedGroupId) selectedGroupId = groups[0].id;
            return;
        }
        loadingGroups = true;
        try {
            const res = await apiFetch("/api/groups");
            const data = (res?.data || []) as Group[];
            setGroups(data);
            if (data.length > 0 && !selectedGroupId) {
                selectedGroupId = data[0].id;
            }
        } catch (e: any) {
            showToast(e.message || "No se pudieron cargar grupos", {
                type: "error",
            });
        } finally {
            loadingGroups = false;
        }
    }

    async function loadGroupTasks() {
        if (!selectedGroupId || !isLoggedIn) {
            groupTasks = [];
            return;
        }
        loadingTasks = true;
        try {
            const res = await apiFetch(`/api/groups/${selectedGroupId}/tasks`);
            groupTasks = (res?.data || []) as GroupTask[];
        } catch (e: any) {
            groupTasks = [];
            showToast(e.message || "No se pudieron cargar tareas del grupo", {
                type: "error",
            });
        } finally {
            loadingTasks = false;
        }
    }

    function prevMonth() {
        currentDate = new Date(year, month - 1, 1);
    }

    function nextMonth() {
        currentDate = new Date(year, month + 1, 1);
    }

    onMount(async () => {
        await loadGroupsIfNeeded();
    });

    $: if (isLoggedIn) {
        loadGroupsIfNeeded();
    }

    $: if (selectedGroupId && isLoggedIn) {
        loadGroupTasks();
    }
</script>

<div class="group-calendar-view">
    <div class="group-calendar-header">
        <h2>Calendario de Grupo</h2>
        {#if isLoggedIn}
            <select bind:value={selectedGroupId} class="task-input-control group-select">
                {#if groups.length === 0}
                    <option value="">Sin grupos</option>
                {:else}
                    {#each groups as group (group.id)}
                        <option value={group.id}>{group.name}</option>
                    {/each}
                {/if}
            </select>
        {/if}
    </div>

    {#if !isLoggedIn}
        <p class="empty-state">Inicia sesión para ver calendarios grupales.</p>
    {:else if loadingGroups}
        <p class="empty-state">Cargando grupos…</p>
    {:else if !selectedGroupId}
        <p class="empty-state">Selecciona o crea un grupo para ver su calendario.</p>
    {:else}
        <div class="calendar-nav">
            <button on:click={prevMonth}>←</button>
            <h3>{monthLabel}</h3>
            <button on:click={nextMonth}>→</button>
        </div>

        {#if loadingTasks}
            <p class="empty-state">Cargando tareas del grupo…</p>
        {:else}
            <div class="calendar-grid">
                {#each DAY_NAMES as day}
                    <div class="day day-name">{day}</div>
                {/each}

                {#each daysInGrid as day}
                    <div class="day {day.isCurrentMonth ? '' : 'other-month'}">
                        <span class="day-number">{day.date.getDate()}</span>
                        {#if day.taskCount > 0}
                            <span class="task-count">{day.taskCount}</span>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</div>

<style>
    .group-calendar-view {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .group-calendar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
    }

    .group-calendar-header h2 {
        margin: 0;
        font-size: 1.15rem;
    }

    .group-select {
        max-width: 260px;
    }

    .calendar-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
    }

    .calendar-nav h3 {
        margin: 0;
        text-transform: capitalize;
    }

    .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.5rem;
    }

    .day {
        min-height: 72px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 10px;
        padding: 0.5rem;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: space-between;
    }

    .day-name {
        min-height: auto;
        justify-content: center;
        align-items: center;
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--text-secondary);
    }

    .day.other-month {
        opacity: 0.5;
    }

    .day-number {
        font-size: 0.88rem;
        font-weight: 600;
    }

    .task-count {
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--app-accent);
    }

    .empty-state {
        margin: 0;
        color: var(--text-secondary);
    }

    @media (max-width: 768px) {
        .group-calendar-header {
            flex-direction: column;
            align-items: stretch;
        }

        .group-select {
            max-width: none;
        }

        .day {
            min-height: 60px;
            padding: 0.4rem;
        }
    }
</style>
