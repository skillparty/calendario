<script lang="ts">
    import { onMount } from "svelte";
    import { flip } from "svelte/animate";
    import {
        tasksStore,
        notifyTasksUpdated,
        updateTasks,
    } from "../store/state";
    import { icons } from "../components/icons";
    import { escapeHtml } from "../utils/helpers";
    import {
        isLoggedInWithBackend,
        updateTaskOnBackend,
        pushLocalTasksToBackend,
    } from "../services/api";
    import { showToast } from "../utils/UIFeedback";
    import { swipe } from "../actions/swipe";

    const HOURS_START = 6;
    const HOURS_END = 22;
    const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    function getWeekStartInfo(date: Date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const day = d.getDay();
        d.setDate(d.getDate() - day);
        return d;
    }

    let weekStart = getWeekStartInfo(new Date());

    $: daysInWeek = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
    });

    $: monthLabel =
        daysInWeek[0].getMonth() === daysInWeek[6].getMonth()
            ? daysInWeek[0].toLocaleDateString("es-ES", {
                  month: "long",
                  year: "numeric",
              })
            : `${daysInWeek[0].toLocaleDateString("es-ES", { month: "short" })} – ${daysInWeek[6].toLocaleDateString("es-ES", { month: "short", year: "numeric" })}`;

    const todayStr = new Date().toDateString();

    function formatDateLocal(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    function formatHour(hour: number) {
        const h = hour % 12 || 12;
        const suffix = hour < 12 ? "AM" : "PM";
        return `${h} ${suffix}`;
    }

    function prevWeek() {
        const d = new Date(weekStart);
        d.setDate(d.getDate() - 7);
        weekStart = d;
    }

    function nextWeek() {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + 7);
        weekStart = d;
    }

    function goToToday() {
        weekStart = getWeekStartInfo(new Date());
    }

    function openTaskModal(dateKey: string | null = null, task: any = null) {
        window.dispatchEvent(
            new CustomEvent("openTaskModal", {
                detail: { date: dateKey, task },
            }),
        );
    }

    function handleCellClick(dateKey: string) {
        const dayStart = new Date(dateKey + "T00:00:00");
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        if (dayStart < todayStart) return;
        openTaskModal(dateKey);
    }

    // Swipe Gestures
    let gridContainer: HTMLElement;
    // handled by use:swipe action

    // Drag and Drop Logic
    let dragOverCell: { date: string; hour: string | "allday" } | null = null;

    function handleDragStart(e: DragEvent, taskId: string, sourceDate: string) {
        if (e.dataTransfer) {
            e.dataTransfer.setData(
                "text/plain",
                JSON.stringify({ taskId, sourceDate }),
            );
            e.dataTransfer.effectAllowed = "move";
        }
    }

    function handleDragOver(
        e: DragEvent,
        dateKey: string,
        hour: string | "allday",
        isPast: boolean,
    ) {
        if (isPast) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        dragOverCell = { date: dateKey, hour };
    }

    function handleDragLeave() {
        dragOverCell = null;
    }

    function handleDrop(
        e: DragEvent,
        targetDate: string,
        targetHour: string | "allday",
        isPast: boolean,
    ) {
        dragOverCell = null;
        if (isPast) return;
        e.preventDefault();

        let payload;
        try {
            payload = JSON.parse(e.dataTransfer?.getData("text/plain") || "");
        } catch {
            return;
        }
        const { taskId, sourceDate } = payload || {};
        if (!taskId || !sourceDate) return;

        let newTime: string | null = null;
        if (targetHour !== "allday") {
            newTime = `${String(targetHour).padStart(2, "0")}:00`;
        }

        let movedTask: any = null;
        updateTasks((draft) => {
            const list = draft[sourceDate];
            if (!list) return draft;
            const idx = list.findIndex((t) => String(t.id) === String(taskId));
            if (idx === -1) return draft;
            [movedTask] = list.splice(idx, 1);

            if (list.length === 0) delete draft[sourceDate];

            movedTask.date = targetDate;
            movedTask.time = newTime;
            movedTask.dirty = true;

            if (!draft[targetDate]) draft[targetDate] = [];
            draft[targetDate].push(movedTask);
            return draft;
        });

        if (movedTask) {
            notifyTasksUpdated();
            showToast("Tarea movida", { type: "success", duration: 2000 });

            if (isLoggedInWithBackend()) {
                const serverId =
                    movedTask.serverId ||
                    (!isNaN(parseInt(movedTask.id))
                        ? parseInt(movedTask.id)
                        : null);
                if (serverId) {
                    updateTaskOnBackend(serverId, {
                        date: targetDate,
                        time: newTime,
                    }).catch(() => {});
                } else {
                    pushLocalTasksToBackend();
                }
            }
        }
    }
</script>

<div class="weekly-nav">
    <button
        id="prev-week"
        class="weekly-nav-btn"
        title="Semana anterior"
        on:click={prevWeek}>&larr;</button
    >
    <h2 class="weekly-title">{monthLabel}</h2>
    <button
        id="today-week"
        class="weekly-today-btn"
        title="Ir a hoy"
        on:click={goToToday}>Hoy</button
    >
    <button
        id="next-week"
        class="weekly-nav-btn"
        title="Semana siguiente"
        on:click={nextWeek}>&rarr;</button
    >
</div>

<div
    class="weekly-grid"
    bind:this={gridContainer}
    use:swipe={{ onSwipeLeft: nextWeek, onSwipeRight: prevWeek, threshold: 50 }}
>
    <div class="weekly-corner"></div>

    {#each daysInWeek as d}
        {@const dateKey = formatDateLocal(d)}
        {@const isToday = d.toDateString() === todayStr}
        <div
            class="weekly-day-header {isToday ? 'weekly-day-today' : ''}"
            data-date={dateKey}
        >
            <span class="weekly-day-name">{DAY_NAMES[d.getDay()]}</span>
            <span class="weekly-day-number">{d.getDate()}</span>
        </div>
    {/each}

    {#each Array.from({ length: HOURS_END - HOURS_START + 1 }, (_, i) => HOURS_START + i) as hour}
        <div class="weekly-time-label">{formatHour(hour)}</div>
        {#each daysInWeek as d}
            {@const dateKey = formatDateLocal(d)}
            {@const dayTasks = $tasksStore[dateKey] || []}
            {@const hourTasks = dayTasks.filter(
                (t) => t.time && parseInt(t.time.split(":")[0], 10) === hour,
            )}
            {@const isPast =
                new Date(new Date(d).setHours(0, 0, 0, 0)) <
                new Date(new Date().setHours(0, 0, 0, 0))}
            {@const isDragOver =
                dragOverCell?.date === dateKey &&
                dragOverCell?.hour === String(hour)}

            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
                class="weekly-cell {isPast
                    ? 'weekly-cell-past'
                    : ''} {isDragOver ? 'drag-over' : ''}"
                on:click={(e) => {
                    if (e.target === e.currentTarget) handleCellClick(dateKey);
                }}
                on:dragover={(e) =>
                    handleDragOver(e, dateKey, String(hour), isPast)}
                on:dragleave={handleDragLeave}
                on:drop={(e) => handleDrop(e, dateKey, String(hour), isPast)}
            >
                {#each hourTasks as task (task.id)}
                    <div
                        animate:flip={{ duration: 300 }}
                        class="weekly-task {task.completed
                            ? 'weekly-task-completed'
                            : ''} weekly-task-{task.priority === 1
                            ? 'high'
                            : task.priority === 2
                              ? 'medium'
                              : 'low'} {task.dirty ? 'dirty' : ''}"
                        draggable="true"
                        title={task.title}
                        on:click={(e) => {
                            e.stopPropagation();
                            openTaskModal(dateKey, task);
                        }}
                        on:dragstart={(e) =>
                            handleDragStart(e, String(task.id), dateKey)}
                    >
                        <span class="weekly-task-time">{task.time}</span>
                        {#if task.dirty}
                            <span
                                class="weekly-dirty-indicator"
                                title="Sin sincronizar"
                                >{@html icons.cloudOff}</span
                            >
                        {/if}
                        <span class="weekly-task-title"
                            >{task.title.length > 18
                                ? escapeHtml(task.title).substring(0, 18) + "…"
                                : escapeHtml(task.title)}</span
                        >
                    </div>
                {/each}
            </div>
        {/each}
    {/each}

    <!-- All Day Tasks Row -->
    <div class="weekly-time-label weekly-allday-label">Todo el día</div>
    {#each daysInWeek as d}
        {@const dateKey = formatDateLocal(d)}
        {@const dayTasks = ($tasksStore[dateKey] || []).filter((t) => !t.time)}
        {@const isPast =
            new Date(new Date(d).setHours(0, 0, 0, 0)) <
            new Date(new Date().setHours(0, 0, 0, 0))}
        {@const isDragOver =
            dragOverCell?.date === dateKey && dragOverCell?.hour === "allday"}

        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            class="weekly-cell weekly-allday {isPast
                ? 'weekly-cell-past'
                : ''} {isDragOver ? 'drag-over' : ''}"
            on:click={(e) => {
                if (e.target === e.currentTarget) handleCellClick(dateKey);
            }}
            on:dragover={(e) => handleDragOver(e, dateKey, "allday", isPast)}
            on:dragleave={handleDragLeave}
            on:drop={(e) => handleDrop(e, dateKey, "allday", isPast)}
        >
            {#each dayTasks as task (task.id)}
                <div
                    animate:flip={{ duration: 300 }}
                    class="weekly-task {task.completed
                        ? 'weekly-task-completed'
                        : ''} weekly-task-{task.priority === 1
                        ? 'high'
                        : task.priority === 2
                          ? 'medium'
                          : 'low'} {task.dirty ? 'dirty' : ''}"
                    draggable="true"
                    title={task.title}
                    on:click={(e) => {
                        e.stopPropagation();
                        openTaskModal(dateKey, task);
                    }}
                    on:dragstart={(e) =>
                        handleDragStart(e, String(task.id), dateKey)}
                >
                    {#if task.dirty}
                        <span
                            class="weekly-dirty-indicator"
                            title="Sin sincronizar">{@html icons.cloudOff}</span
                        >
                    {/if}
                    <span class="weekly-task-title"
                        >{task.title.length > 18
                            ? escapeHtml(task.title).substring(0, 18) + "…"
                            : escapeHtml(task.title)}</span
                    >
                </div>
            {/each}
        </div>
    {/each}
</div>
