<script lang="ts">
    import {
        currentDateStore,
        tasksStore,
        setCurrentDate,
        notifyTasksUpdated,
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
    import { onMount } from "svelte";
    import { flip } from "svelte/animate";

    function getMonthName(month: number) {
        const months = [
            "Enero",
            "Febrero",
            "Marzo",
            "Abril",
            "Mayo",
            "Junio",
            "Julio",
            "Agosto",
            "Septiembre",
            "Octubre",
            "Noviembre",
            "Diciembre",
        ];
        return months[month];
    }

    function isToday(date: Date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    function formatDateLocal(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    $: year = $currentDateStore.getFullYear();
    $: month = $currentDateStore.getMonth();

    let daysInGrid: {
        date: Date;
        dateKey: string;
        isCurrentMonth: boolean;
        isToday: boolean;
        isPast: boolean;
        pendingTasks: number;
        totalTasks: number;
        previewTasks: any[];
    }[] = [];

    $: {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const newDays = [];
        for (
            let d = new Date(startDate);
            d <= lastDay;
            d.setDate(d.getDate() + 1)
        ) {
            const dateKey = formatDateLocal(d);
            const dayTasks = $tasksStore[dateKey] || [];
            const pendingTasks = dayTasks.filter((t) => !t.completed).length;

            const dayStart = new Date(d);
            dayStart.setHours(0, 0, 0, 0);

            const previewTasks = dayTasks
                .filter((t) => !t.completed)
                .sort((a, b) => {
                    if (!a.time && !b.time) return 0;
                    if (!a.time) return 1;
                    if (!b.time) return -1;
                    return a.time.localeCompare(b.time);
                })
                .slice(0, 2);

            newDays.push({
                date: new Date(d),
                dateKey,
                isCurrentMonth: d.getMonth() === month,
                isToday: isToday(d),
                isPast: dayStart < todayStart,
                pendingTasks,
                totalTasks: dayTasks.length,
                previewTasks,
            });
        }
        daysInGrid = newDays;
    }

    function prevMonth() {
        setCurrentDate(new Date(year, month - 1, 1));
    }

    function nextMonth() {
        setCurrentDate(new Date(year, month + 1, 1));
    }

    function openDayTasks(dateKey: string) {
        window.dispatchEvent(
            new CustomEvent("openDayModal", { detail: { date: dateKey } }),
        );
    }

    function openTaskModal(dateKey: string, e: Event) {
        e.stopPropagation();
        window.dispatchEvent(
            new CustomEvent("openTaskModal", { detail: { date: dateKey } }),
        );
    }

    // Swipe Gestures (Handled by action)

    // Drag and drop logic
    function handleDragStart(e: DragEvent, taskId: string, sourceDate: string) {
        if (e.dataTransfer) {
            e.dataTransfer.setData(
                "text/plain",
                JSON.stringify({ taskId, sourceDate }),
            );
            e.dataTransfer.effectAllowed = "move";
        }
    }

    let dragOverDate: string | null = null;

    function handleDragOver(e: DragEvent, dateKey: string, isPast: boolean) {
        if (isPast) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        dragOverDate = dateKey;
    }

    function handleDragLeave() {
        dragOverDate = null;
    }

    function handleDrop(e: DragEvent, targetDate: string, isPast: boolean) {
        dragOverDate = null;
        if (isPast) return;
        e.preventDefault();
        let payload;
        try {
            payload = JSON.parse(e.dataTransfer?.getData("text/plain") || "");
        } catch {
            return;
        }
        const { taskId, sourceDate } = payload || {};
        if (!taskId || !sourceDate || sourceDate === targetDate) return;

        let movedTask: any;
        tasksStore.update((draft) => {
            const list = draft[sourceDate];
            if (!list) return draft;
            const idx = list.findIndex((t) => t.id === taskId);
            if (idx === -1) return draft;
            [movedTask] = list.splice(idx, 1);
            movedTask.date = targetDate;
            if (list.length === 0) delete draft[sourceDate];
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
                    (typeof movedTask.id === "number"
                        ? movedTask.id
                        : !isNaN(parseInt(movedTask.id))
                          ? parseInt(movedTask.id)
                          : null);
                if (serverId) {
                    updateTaskOnBackend(serverId, { date: targetDate }).catch(
                        () => {},
                    );
                } else {
                    pushLocalTasksToBackend();
                }
            }
        }
    }
</script>

<div class="calendar-nav">
    <button id="prev-month" title="Mes anterior" on:click={prevMonth}>
        ← {getMonthName(month === 0 ? 11 : month - 1)}
    </button>
    <h2>{getMonthName(month)} {year}</h2>
    <button id="next-month" title="Mes siguiente" on:click={nextMonth}>
        {getMonthName(month === 11 ? 0 : month + 1)} →
    </button>
</div>

<div
    class="calendar-grid"
    use:swipe={{
        onSwipeLeft: nextMonth,
        onSwipeRight: prevMonth,
        threshold: 60,
    }}
>
    <div class="day">Dom</div>
    <div class="day">Lun</div>
    <div class="day">Mar</div>
    <div class="day">Mié</div>
    <div class="day">Jue</div>
    <div class="day">Vie</div>
    <div class="day">Sáb</div>

    {#each daysInGrid as { date, dateKey, isCurrentMonth, isToday, isPast, pendingTasks, totalTasks, previewTasks }}
        <div
            class="day {isCurrentMonth ? '' : 'other-month'} {isToday
                ? 'today'
                : ''} {isPast ? 'past-date' : ''} {dragOverDate === dateKey
                ? 'drag-over'
                : ''}"
            tabindex="0"
            role="button"
            aria-label="{dateKey} - {pendingTasks} tareas pendientes"
            on:click={() => openDayTasks(dateKey)}
            on:dragover={(e) => handleDragOver(e, dateKey, isPast)}
            on:dragleave={handleDragLeave}
            on:drop={(e) => handleDrop(e, dateKey, isPast)}
            on:keydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDayTasks(dateKey);
                }
            }}
        >
            <div class="day-content">
                <span class="day-number">{date.getDate()}</span>
                {#if totalTasks > 0}
                    <small class="task-count">{pendingTasks} pendiente(s)</small
                    >
                {/if}
                {#if previewTasks.length > 0}
                    <div class="task-preview-list">
                        {#each previewTasks as task (task.id)}
                            <!-- svelte-ignore a11y-no-static-element-interactions -->
                            <div
                                animate:flip={{ duration: 300 }}
                                class="task-preview-item"
                                draggable="true"
                                on:dragstart={(e) =>
                                    handleDragStart(
                                        e,
                                        String(task.id),
                                        dateKey,
                                    )}
                            >
                                <span class="task-time">{task.time || ""}</span>
                                {#if task.dirty}
                                    <span
                                        class="task-preview-dirty"
                                        title="Sin sincronizar"
                                        >{@html icons.cloudOff}</span
                                    >
                                {/if}
                                <span class="task-title"
                                    >{task.title.length > 15
                                        ? escapeHtml(task.title).substring(
                                              0,
                                              15,
                                          ) + "..."
                                        : escapeHtml(task.title)}</span
                                >
                            </div>
                        {/each}
                    </div>
                {/if}
                {#if !isPast}
                    <button
                        class="day-add-btn"
                        title="Agregar recordatorio"
                        tabindex="-1"
                        on:click={(e) => openTaskModal(dateKey, e)}>+</button
                    >
                {/if}
            </div>
        </div>
    {/each}
</div>
