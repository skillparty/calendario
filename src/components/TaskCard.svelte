<script lang="ts">
    import { icons, getIcon } from "./icons";
    import { escapeHtml } from "../utils/helpers";
    import { swipe } from "../actions/swipe";
    import type { Task } from "../types";
    import { createEventDispatcher } from "svelte";

    export let task: Task;
    export let allowEdit = true;
    export let allowDelete = true;
    export let showDescription = true;

    const dispatch = createEventDispatcher();

    function handleToggle() {
        dispatch("toggle", task.id);
    }

    function handleEdit(e: Event) {
        e.stopPropagation();
        dispatch("edit", task);
    }

    function handleDelete(e: Event) {
        e.stopPropagation();
        dispatch("delete", task);
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<li
    class="task-card {task.completed ? 'completed' : ''}"
    style="border-left: 4px solid {task.priority === 1
        ? 'var(--error)'
        : task.priority === 2
          ? 'var(--warning-color)'
          : 'var(--primary-color)'};"
    use:swipe={{
        onSwipeLeft: () => {
            if (allowDelete) dispatch("delete", task);
        },
        onSwipeRight: () => {
            dispatch("toggle", task.id);
        },
        threshold: 70,
    }}
>
    <div class="task-card-header">
        <div class="task-card-title-group">
            <button
                class="task-checkbox"
                aria-label="Toggle task"
                on:click={handleToggle}
            >
                {#if task.completed}
                    {@html getIcon("checkCircle", "icon-completed")}
                {:else}
                    <div class="circle-empty"></div>
                {/if}
            </button>
            <h4
                class="task-card-title"
                style={allowEdit ? "cursor:pointer;" : ""}
                on:click={(e) => {
                    if (allowEdit) handleEdit(e);
                }}
            >
                {escapeHtml(task.title)}
            </h4>
            {#if task.dirty}
                <span
                    class="sync-status dirty"
                    title="Esperando para sincronizar"
                >
                    {@html icons.cloudOff}
                </span>
            {/if}
        </div>
        {#if task.time}
            <div class="task-time-pill">
                <span class="icon" aria-hidden="true">{@html icons.clock}</span>
                {escapeHtml(task.time)}
            </div>
        {/if}
    </div>
    {#if showDescription && task.description}
        <p class="task-card-description">
            {escapeHtml(task.description)}
        </p>
    {/if}
    <div class="task-card-footer">
        <div class="task-metadata">
            <span
                class="task-priority badge {task.priority === 1
                    ? 'high'
                    : task.priority === 2
                      ? 'medium'
                      : 'low'}"
            >
                {@html task.priority === 1
                    ? icons.priorityHigh
                    : task.priority === 2
                      ? icons.priorityMedium
                      : icons.priorityLow}
                {task.priority === 1
                    ? "Alta"
                    : task.priority === 2
                      ? "Media"
                      : "Baja"}
            </span>
            {#if task.tags && task.tags.length > 0}
                {#each task.tags as tag}
                    <span class="task-tag badge">{escapeHtml(tag)}</span>
                {/each}
            {/if}
        </div>
        <div class="task-actions-menu">
            {#if allowEdit}
                <button
                    class="btn-icon-small"
                    title="Editar"
                    on:click={handleEdit}>{@html icons.edit}</button
                >
            {/if}
            {#if allowDelete}
                <button
                    class="btn-icon-small danger"
                    title="Eliminar"
                    on:click={handleDelete}>{@html icons.trash}</button
                >
            {/if}
        </div>
    </div>
</li>
