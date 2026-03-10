<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { fly } from "svelte/transition";
    import type { GroupTask, GroupRole } from "../types";

    export let task: GroupTask;
    export let showDate = true;
    export let allowStatusChange = true;

    const dispatch = createEventDispatcher<{
        statusChange: { id: string | number; status: string };
        click: { task: GroupTask };
    }>();

    const STATUS_CONFIG: Record<
        string,
        { label: string; color: string; bg: string }
    > = {
        todo: { label: "Pendiente", color: "#6b7280", bg: "#f3f4f6" },
        in_progress: { label: "En progreso", color: "#d97706", bg: "#fffbeb" },
        done: { label: "Hecho", color: "#16a34a", bg: "#f0fdf4" },
        blocked: { label: "Bloqueado", color: "#dc2626", bg: "#fef2f2" },
    };

    const PRIORITY_DOT: Record<number, string> = {
        1: "#e53e3e",
        2: "#e6a817",
        3: "#0066cc",
    };

    $: status = task.task_status ?? "todo";
    $: cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.todo;
    $: priorityColor = PRIORITY_DOT[task.priority ?? 3] ?? PRIORITY_DOT[3];

    function cycleStatus() {
        if (!allowStatusChange) return;
        const order: string[] = ["todo", "in_progress", "done", "blocked"];
        const next = order[(order.indexOf(status) + 1) % order.length];
        dispatch("statusChange", { id: task.id, status: next });
    }

    function formatDate(d: string | null) {
        if (!d) return "";
        const date = new Date(d + "T00:00:00");
        return date.toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
        });
    }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
    class="group-task-card"
    in:fly={{ y: 8, duration: 200 }}
    on:click={() => dispatch("click", { task })}
    on:keydown={(e) => e.key === "Enter" && dispatch("click", { task })}
    role="button"
    tabindex="0"
>
    <!-- Priority dot -->
    <span
        class="priority-dot"
        style="background: {priorityColor}"
        aria-label="Prioridad {task.priority}"
    ></span>

    <!-- Main content -->
    <div class="card-body">
        <p class="card-title" class:completed={task.completed}>{task.title}</p>

        <div class="card-meta">
            {#if showDate && task.date}
                <span class="meta-date">📅 {formatDate(task.date)}</span>
            {/if}
            {#if task.time}
                <span class="meta-time">🕐 {task.time}</span>
            {/if}
        </div>

        <!-- Assignee -->
        {#if task.assigned_user}
            <div class="assignee">
                <img
                    src={task.assigned_user.avatar_url ?? "/app.png"}
                    alt={task.assigned_user.name ??
                        task.assigned_user.username ??
                        ""}
                    class="assignee-avatar"
                />
                <span class="assignee-name">
                    {task.assigned_user.name ??
                        task.assigned_user.username ??
                        "Asignado"}
                </span>
            </div>
        {/if}
    </div>

    <!-- Status badge (tap to cycle) -->
    <button
        class="status-badge"
        style="color:{cfg.color}; background:{cfg.bg};"
        title="Cambiar estado"
        on:click|stopPropagation={cycleStatus}
        disabled={!allowStatusChange}
    >
        {cfg.label}
    </button>
</div>

<style>
    .group-task-card {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 14px;
        cursor: pointer;
        transition:
            box-shadow 0.15s,
            transform 0.12s;
        -webkit-tap-highlight-color: transparent;
    }

    .group-task-card:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
        transform: translateY(-1px);
    }

    .group-task-card:active {
        transform: scale(0.98);
    }

    .priority-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .card-body {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .card-title {
        margin: 0;
        font-size: 0.9rem;
        font-weight: 600;
        line-height: 1.35;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .card-title.completed {
        text-decoration: line-through;
        opacity: 0.55;
    }

    .card-meta {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .meta-date,
    .meta-time {
        font-size: 0.72rem;
        color: var(--text-secondary);
    }

    .assignee {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin-top: 0.1rem;
    }

    .assignee-avatar {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        object-fit: cover;
    }

    .assignee-name {
        font-size: 0.72rem;
        color: var(--text-secondary);
    }

    .status-badge {
        flex-shrink: 0;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 0.25rem 0.6rem;
        border-radius: 999px;
        border: none;
        cursor: pointer;
        transition:
            opacity 0.15s,
            filter 0.15s;
    }

    .status-badge:hover {
        filter: brightness(0.92);
    }

    .status-badge:disabled {
        cursor: default;
        opacity: 0.7;
    }
</style>
