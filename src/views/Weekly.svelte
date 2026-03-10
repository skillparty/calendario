<script lang="ts">
    import { onMount } from "svelte";
    import { flip } from "svelte/animate";
    import { tasksStore, notifyTasksUpdated, updateTasks } from "../store/state";
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
    let isMobile = false;
    let mobileWindowStart = 0;

    $: daysInWeek = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
    });

    $: visibleDays = isMobile
        ? daysInWeek.slice(mobileWindowStart, mobileWindowStart + 3)
        : daysInWeek;

    $: if (!isMobile && mobileWindowStart !== 0) {
        mobileWindowStart = 0;
    }

    $: if (isMobile && mobileWindowStart > 4) {
        mobileWindowStart = 4;
    }

    $: monthLabel =
        daysInWeek[0].getMonth() === daysInWeek[6].getMonth()
            ? daysInWeek[0].toLocaleDateString("es-ES", {
                  month: "long",
                  year: "numeric",
              })
            : `${daysInWeek[0].toLocaleDateString("es-ES", { month: "short" })} – ${daysInWeek[6].toLocaleDateString("es-ES", { month: "short", year: "numeric" })}`;

    $: visibleLabel =
        visibleDays[0] && visibleDays[visibleDays.length - 1]
            ? `${visibleDays[0].toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – ${visibleDays[visibleDays.length - 1].toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`
            : monthLabel;

    $: navigationLabel = isMobile ? visibleLabel : monthLabel;

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
        mobileWindowStart = isMobile ? 4 : 0;
    }

    function nextWeek() {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + 7);
        weekStart = d;
        mobileWindowStart = 0;
    }

    function goToToday() {
        weekStart = getWeekStartInfo(new Date());
        if (isMobile) {
            const todayIndex = new Date().getDay(); // 0=Sun ... 6=Sat
            // Center today in the 3-day window: show [today-1, today, today+1]
            mobileWindowStart = Math.max(0, Math.min(4, todayIndex - 1));
        } else {
            mobileWindowStart = 0;
        }
    }

    function handleSwipeLeft() {
        if (isMobile) {
            if (mobileWindowStart < 4) {
                mobileWindowStart += 1;
                return;
            }
            nextWeek();
            return;
        }
        nextWeek();
    }

    function handleSwipeRight() {
        if (isMobile) {
            if (mobileWindowStart > 0) {
                mobileWindowStart -= 1;
                return;
            }
            prevWeek();
            return;
        }
        prevWeek();
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

    function updateViewportMode() {
        isMobile =
            typeof window !== "undefined" &&
            window.matchMedia("(max-width: 768px)").matches;
    }

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

    onMount(() => {
        updateViewportMode();
        if (isMobile) {
            const todayIndex = new Date().getDay();
            mobileWindowStart = Math.max(0, Math.min(4, todayIndex - 1));
        }
        window.addEventListener("resize", updateViewportMode, {
            passive: true,
        });

        return () => {
            window.removeEventListener("resize", updateViewportMode);
        };
    });
</script>

<div class="weekly-nav">
    <button
        id="prev-week"
        class="weekly-nav-btn"
        title="Semana anterior"
        on:click={prevWeek}>&larr;</button>
    <h2 class="weekly-title">{navigationLabel}</h2>
    <button
        id="today-week"
        class="weekly-today-btn"
        title="Ir a hoy"
        on:click={goToToday}>Hoy</button>
    <button
        id="next-week"
        class="weekly-nav-btn"
        title="Semana siguiente"
        on:click={nextWeek}>&rarr;</button>
</div>

<div
    class="weekly-grid {isMobile ? 'mobile-three-days' : ''}"
    use:swipe={{
        onSwipeLeft: handleSwipeLeft,
        onSwipeRight: handleSwipeRight,
        threshold: 50,
    }}
>
    <div class="weekly-corner"></div>

    {#each visibleDays as d}
        {@const dateKey = formatDateLocal(d)}
        {@const isToday = d.toDateString() === todayStr}
        <div
            class="weekly-day-header {isToday ? 'weekly-day-today' : ''}"
            data-date={dateKey}
            data-day-index={d.getDay()}
        >
            <span class="weekly-day-name">{DAY_NAMES[d.getDay()]}</span>
            <span class="weekly-day-number">{d.getDate()}</span>
        </div>
    {/each}

    {#each Array.from({ length: HOURS_END - HOURS_START + 1 }, (_, i) => HOURS_START + i) as hour}
        <div class="weekly-time-label">{formatHour(hour)}</div>
        {#each visibleDays as d}
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
                    : ''} {isDragOver ? 'drag-over' : ''} {hourTasks.length ===
                0
                    ? 'weekly-cell-empty'
                    : ''}"
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

    <div class="weekly-time-label weekly-allday-label">Todo el día</div>
    {#each visibleDays as d}
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
                : ''} {isDragOver ? 'drag-over' : ''} {dayTasks.length === 0
                ? 'weekly-cell-empty'
                : ''}"
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

{#if isMobile}
    <div class="swipe-indicator">
        {#each Array(5) as _, i}
            <span
                class="swipe-dot {mobileWindowStart === i ? 'active' : ''}"
            ></span>
        {/each}
    </div>
{/if}

<style>
    /* ===== Mobile 3-day swipe layout ===== */
    @media (max-width: 768px) {
        .weekly-nav {
            display: grid;
            grid-template-columns: auto 1fr auto;
            grid-template-areas:
                "prev title next"
                "today today today";
            gap: 0.5rem;
            margin-bottom: 0.5rem;
            padding: 0.5rem 0.25rem;
        }

        #prev-week {
            grid-area: prev;
        }

        #next-week {
            grid-area: next;
        }

        #today-week {
            grid-area: today;
            width: 100%;
        }

        .weekly-title {
            grid-area: title;
            font-size: 0.95rem;
            line-height: 1.2;
            padding: 0 0.25rem;
            text-align: center;
        }

        .weekly-nav-btn,
        .weekly-today-btn {
            min-width: 44px;
            min-height: 44px;
        }

        .weekly-grid.mobile-three-days {
            grid-template-columns: 46px repeat(3, minmax(0, 1fr));
            gap: 2px;
            width: 100%;
            min-width: 0;
        }

        .weekly-corner {
            min-height: 52px;
        }

        .weekly-day-header {
            padding: 0.5rem 0.25rem;
            min-height: 52px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2px;
        }

        .weekly-day-name {
            font-size: 0.68rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.02em;
        }

        .weekly-day-number {
            font-size: 1rem;
            font-weight: 700;
            line-height: 1.1;
        }

        .weekly-day-today .weekly-day-number {
            background: var(--app-accent, #0066cc);
            color: #fff;
            width: 28px;
            height: 28px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
        }

        .weekly-time-label {
            font-size: 0.6rem;
            padding: 0.15rem 0.2rem;
            min-height: 52px;
        }

        .weekly-cell {
            min-height: 52px;
            padding: 3px;
            gap: 3px;
        }

        .weekly-cell.weekly-cell-empty {
            min-height: 44px;
        }

        .weekly-task {
            font-size: 0.68rem;
            padding: 4px 5px;
            gap: 3px;
            min-height: 28px;
            border-radius: 5px;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
        }

        .weekly-task:active {
            opacity: 0.8;
            transform: scale(0.97);
        }

        .weekly-task-time {
            font-size: 0.6rem;
            font-weight: 700;
        }

        .weekly-task-title {
            white-space: normal;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            line-height: 1.3;
        }

        .weekly-allday {
            min-height: 56px;
        }

        .weekly-allday-label {
            font-size: 0.58rem;
        }

        .swipe-indicator {
            display: flex;
            justify-content: center;
            gap: 5px;
            padding: 8px 0 4px;
        }

        .swipe-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--border-color, #ccc);
            transition: all 0.25s ease;
        }

        .swipe-dot.active {
            background: var(--app-accent, #0066cc);
            width: 18px;
            border-radius: 3px;
        }
    }

    @media (max-width: 390px) {
        .weekly-grid.mobile-three-days {
            grid-template-columns: 40px repeat(3, minmax(0, 1fr));
        }

        .weekly-time-label,
        .weekly-cell {
            min-height: 48px;
        }

        .weekly-cell.weekly-cell-empty {
            min-height: 40px;
        }

        .weekly-day-name {
            font-size: 0.62rem;
        }

        .weekly-day-number {
            font-size: 0.9rem;
        }

        .weekly-task {
            font-size: 0.62rem;
            padding: 3px 4px;
        }

        .weekly-task-time {
            font-size: 0.56rem;
        }
    }
</style>
