<script lang="ts">
    import { onMount } from "svelte";
    import { fade, scale } from "svelte/transition";
    import { backOut } from "svelte/easing";
    import { tasksStore, notifyTasksUpdated, requestOpenTaskModal } from "../store/state";
    import { icons } from "../components/icons";
    import { escapeHtml } from "../utils/helpers";
    import { confirmDeleteTask, toggleTask } from "../utils/taskActions";
    import { isLoggedInWithBackend } from "../services/api";
    import TaskCard from "../components/TaskCard.svelte";

    export let showModal = false;
    export let selectedDate: string | null = null;
    let justOpened = false;

    $: isPastDate = selectedDate
        ? new Date(selectedDate + "T00:00:00") <
          new Date(new Date().setHours(0, 0, 0, 0))
        : false;
    $: dayTasks = selectedDate ? $tasksStore[selectedDate] || [] : [];

    function formatDateForDisplay(dateString: string) {
        const date = new Date(dateString + "T00:00:00");
        return date.toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }

    function close() {
        showModal = false;
        justOpened = false;
    }

    /** Close only if user clicked the backdrop overlay directly */
    function handleBackdropClick(e: MouseEvent) {
        if (justOpened) return;
        const target = e.target as HTMLElement;
        if (target && target.classList.contains('view-svelte-modal')) {
            close();
        }
    }

    function handleEscape(e: KeyboardEvent) {
        if (e.key === 'Escape') close();
    }

    function openTaskInputModal() {
        if (selectedDate) {
            requestOpenTaskModal(selectedDate, null);
        }
        close();
    }

    function handleToggle(taskId: string | number) {
        if (selectedDate) {
            toggleTask(String(taskId));
        }
    }

    function handleDelete(taskId: string | number) {
        const task = dayTasks.find((t) => String(t.id) === String(taskId));
        if (task) {
            // confirmDeleteTask from legacy taskActions.js
            if (
                typeof window !== "undefined" &&
                window.confirm("¿Eliminar esta tarea?")
            ) {
                confirmDeleteTask(String(taskId), task.title);
            }
        }
    }

    onMount(() => {
        const handleOpen = (e: CustomEvent) => {
            selectedDate = e.detail.date;
            justOpened = true;
            showModal = true;
            requestAnimationFrame(() => { justOpened = false; });
        };
        window.addEventListener("openDayModal", handleOpen as EventListener);
        return () =>
            window.removeEventListener(
                "openDayModal",
                handleOpen as EventListener,
            );
    });
</script>

{#if showModal && selectedDate}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class="modal view-svelte-modal"
        aria-hidden={!showModal}
        transition:fade={{ duration: 200 }}
        on:click={handleBackdropClick}
        on:keydown={handleEscape}
    >
        <div
            class="modal-content"
            role="dialog"
            aria-modal="true"
            in:scale={{ duration: 300, start: 0.95, easing: backOut }}
            out:scale={{ duration: 200, start: 0.95 }}
        >
            <button
                type="button"
                class="close-btn"
                aria-label="Cerrar modal"
                on:click={close}>&times;</button
            >
            <h3>{formatDateForDisplay(selectedDate)}</h3>

            <div id="modal-tasks">
                {#if dayTasks.length === 0}
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            {@html icons.inbox}
                        </div>
                        <h4 class="empty-state-title">Día libre</h4>
                        <p class="empty-state-text">
                            Sin tareas programadas para este día. Planifica
                            agregando una tarea.
                        </p>
                    </div>
                {:else}
                    {#each dayTasks as task}
                        <TaskCard
                            {task}
                            showDescription={false}
                            allowEdit={!isPastDate}
                            allowDelete={!isPastDate}
                            on:toggle={(e) => handleToggle(e.detail)}
                            on:edit={(e) => {
                                requestOpenTaskModal(selectedDate, e.detail);
                                close();
                            }}
                            on:delete={(e) => handleDelete(e.detail.id)}
                        />
                    {/each}
                {/if}
            </div>

            {#if !isPastDate}
                <button id="add-task-modal-btn" on:click={openTaskInputModal}
                    >Agregar Tarea</button
                >
            {/if}
        </div>
    </div>
{/if}

<style>
    .view-svelte-modal {
        display: flex;
        z-index: 1000;
    }
</style>
