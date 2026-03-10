<script lang="ts">
    import { onMount } from "svelte";
    import { fade, scale } from "svelte/transition";
    import { backOut } from "svelte/easing";
    import {
        tasksStore,
        notifyTasksUpdated,
        requestOpenTaskModal,
    } from "../store/state";
    import { icons } from "../components/icons";
    import { escapeHtml } from "../utils/helpers";
    import { confirmDeleteTask, toggleTask } from "../utils/taskActions";
    import { isLoggedInWithBackend } from "../services/api";
    import TaskCard from "../components/TaskCard.svelte";

    export let showModal = false;
    export let selectedDate: string | null = null;
    let justOpened = false;

    // ---- Drag-to-dismiss ----
    let dragStartY = 0;
    let dragCurrentY = 0;
    let dragging = false;

    function onHandleTouchStart(e: TouchEvent) {
        dragStartY = e.touches[0].clientY;
        dragging = true;
    }
    function onHandleTouchMove(e: TouchEvent) {
        if (!dragging) return;
        dragCurrentY = e.touches[0].clientY;
    }
    function onHandleTouchEnd() {
        if (!dragging) return;
        dragging = false;
        if (dragCurrentY - dragStartY > 80) close();
        dragCurrentY = dragStartY;
    }

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
        if (target && target.classList.contains("view-svelte-modal")) {
            close();
        }
    }

    function handleEscape(e: KeyboardEvent) {
        if (e.key === "Escape") close();
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
            requestAnimationFrame(() => {
                justOpened = false;
            });
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
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
                class="modal-drag-handle"
                aria-hidden="true"
                on:touchstart={onHandleTouchStart}
                on:touchmove={onHandleTouchMove}
                on:touchend={onHandleTouchEnd}
            ></div>
            <button
                type="button"
                class="close-btn"
                aria-label="Cerrar modal"
                on:click={close}>&times;</button
            >
            <h3>{formatDateForDisplay(selectedDate)}</h3>

            <div id="modal-tasks" class="modal-tasks-scroll">
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

    .modal-content {
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    /* Drag handle — reuses same class as TaskModal, styled globally */
    .modal-drag-handle {
        width: 44px;
        height: 5px;
        border-radius: 3px;
        background: var(--border-color, rgba(0, 0, 0, 0.18));
        margin: 0 auto 10px;
        cursor: grab;
        flex-shrink: 0;
    }

    @media (min-width: 769px) {
        .modal-drag-handle {
            display: none;
        }
    }

    .modal-tasks-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        padding-right: 0.25rem;
    }

    @media (max-width: 768px) {
        .modal-content {
            max-height: calc(
                100dvh - max(env(safe-area-inset-bottom), 0px) - 96px
            );
        }
    }
</style>
