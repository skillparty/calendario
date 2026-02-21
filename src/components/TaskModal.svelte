<script lang="ts">
    import { onMount } from "svelte";
    import { fade, scale } from "svelte/transition";
    import { backOut } from "svelte/easing";
    import {
        tasksStore,
        notifyTasksUpdated,
        updateTasks,
    } from "../store/state";
    import { icons } from "../components/icons";
    import { escapeHtml } from "../utils/helpers";
    import {
        isLoggedInWithBackend,
        createTaskOnBackend,
        updateTaskOnBackend,
        pushLocalTasksToBackend,
    } from "../services/api";
    import { showToast } from "../utils/UIFeedback";
    import type { Task } from "../types";
    import { clickOutside } from "../actions/clickOutside";

    export let showModal = false;

    let date = "";
    let existingTask: Task | null = null;

    // Form State
    let title = "";
    let description = "";
    let time = "";
    let taskDate = "";
    let priority: 1 | 2 | 3 = 3;
    let tags: string[] = [];
    let currentTagInput = "";
    let recurrence = "";
    let isReminder = true;

    function resetForm() {
        title = "";
        description = "";
        time = "";
        taskDate = date || "";
        priority = 3;
        tags = [];
        currentTagInput = "";
        recurrence = "";
        isReminder = true;
    }

    function loadForm() {
        if (existingTask) {
            title = existingTask.title || "";
            description = existingTask.description || "";
            time = existingTask.time || "";
            taskDate = existingTask.date || "";
            priority = (existingTask.priority as 1 | 2 | 3) || 3;
            tags = existingTask.tags ? [...existingTask.tags] : [];
            isReminder = existingTask.isReminder !== false;
        } else {
            resetForm();
        }
    }

    function close() {
        showModal = false;
    }

    function handleAddTag(e: KeyboardEvent) {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            const tag = currentTagInput.trim().toLowerCase();
            if (tag && tag.length <= 30 && !tags.includes(tag)) {
                tags = [...tags, tag];
            }
            currentTagInput = "";
        } else if (e.key === "Backspace" && currentTagInput === "") {
            if (tags.length > 0) {
                tags = tags.slice(0, -1);
            }
        }
    }

    function removeTag(tagToRemove: string) {
        tags = tags.filter((t) => t !== tagToRemove);
    }

    function createLocalTaskId() {
        return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function saveTask() {
        const finalTitle = title.trim();
        if (!finalTitle) {
            showToast("El título es obligatorio", { type: "error" });
            return;
        }

        const finalDate = taskDate || date;
        if (!finalDate) {
            showToast("La fecha es obligatoria", { type: "error" });
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDate = new Date(finalDate + "T00:00:00");
        if (selectedDate < today && !existingTask) {
            showToast("No puedes agregar tareas a fechas pasadas.", {
                type: "warning",
                duration: 3800,
            });
            return;
        }

        const taskObj: Task = {
            id: existingTask ? existingTask.id : createLocalTaskId(),
            title: finalTitle,
            description: description.trim(),
            time,
            priority,
            tags,
            completed: existingTask ? existingTask.completed : false,
            date: finalDate,
            isReminder,
            dirty: true,
        };
        if (existingTask && existingTask.serverId) {
            taskObj.serverId = existingTask.serverId;
        }

        // Recurrence logic (for new tasks only locally in this simplified view)
        let datesToProcess = [finalDate];
        if (!existingTask && recurrence) {
            // Simplified: Just add the base occurrence for now, backend will handle recurrence engine.
            // Or in standard local mode we generate limited occurrences.
            taskObj.recurrence = recurrence as
                | "daily"
                | "weekly"
                | "monthly"
                | "yearly";
        }

        updateTasks((draft) => {
            datesToProcess.forEach((d) => {
                if (!draft[d]) draft[d] = [];
                if (existingTask) {
                    const idx = draft[d].findIndex(
                        (t) => String(t.id) === String(existingTask!.id),
                    );
                    if (idx !== -1)
                        draft[d][idx] = { ...draft[d][idx], ...taskObj };
                    else draft[d].push(taskObj); // Moved date
                } else {
                    draft[d].push(taskObj);
                }
            });
            // Handle date change
            if (
                existingTask &&
                existingTask.date &&
                existingTask.date !== finalDate &&
                draft[existingTask.date]
            ) {
                const oldDate = existingTask.date;
                draft[oldDate] = draft[oldDate].filter(
                    (t: Task) => String(t.id) !== String(existingTask!.id),
                );
                if (draft[oldDate].length === 0) delete draft[oldDate];
            }
        });

        close();
        showToast(existingTask ? "Tarea actualizada" : "Tarea creada", {
            type: "success",
        });

        // Backend sync
        if (isLoggedInWithBackend()) {
            if (existingTask && existingTask.serverId) {
                updateTaskOnBackend(existingTask.serverId, taskObj).catch(
                    console.error,
                );
            } else {
                createTaskOnBackend({
                    title: taskObj.title,
                    description: taskObj.description,
                    time: taskObj.time,
                    priority: taskObj.priority,
                    tags: taskObj.tags,
                    date: taskObj.date,
                    recurrence: taskObj.recurrence,
                })
                    .then((res) => {
                        if (res) pushLocalTasksToBackend();
                    })
                    .catch(console.error);
            }
        }
    }

    onMount(() => {
        const handleOpen = (e: CustomEvent) => {
            date = e.detail.date || "";
            existingTask = e.detail.task || null;
            loadForm();
            showModal = true;
        };
        window.addEventListener("openTaskModal", handleOpen as EventListener);
        return () =>
            window.removeEventListener(
                "openTaskModal",
                handleOpen as EventListener,
            );
    });
</script>

{#if showModal}
    <div
        class="modal view-svelte-modal"
        aria-hidden={!showModal}
        transition:fade={{ duration: 200 }}
    >
        <div
            class="modal-content task-input-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-input-modal-title"
            in:scale={{ duration: 300, start: 0.95, easing: backOut }}
            out:scale={{ duration: 200, start: 0.95 }}
        >
            <button
                type="button"
                class="close-btn"
                aria-label="Cerrar modal"
                on:click={close}>&times;</button
            >

            <h3 id="task-input-modal-title">
                {existingTask
                    ? "Editar Tarea"
                    : date
                      ? "Nueva Tarea"
                      : "Nueva Tarea Rápida"}
            </h3>

            <div class="task-input-form-group">
                <label for="task-title-input">Título</label>
                <!-- svelte-ignore a11y-autofocus -->
                <input
                    type="text"
                    id="task-title-input"
                    placeholder="Nombre de la tarea"
                    bind:value={title}
                    class="task-input-control"
                    autofocus
                    on:keydown={(e) => e.key === "Enter" && saveTask()}
                />
            </div>

            <div class="task-input-form-group">
                <label for="task-description-input"
                    >Descripción (opcional)</label
                >
                <textarea
                    id="task-description-input"
                    placeholder="Agrega detalles..."
                    rows="2"
                    class="task-input-control"
                    bind:value={description}
                ></textarea>
            </div>

            <div class="task-input-row">
                {#if !date || existingTask}
                    <div class="task-input-form-group">
                        <label for="task-date-input">Fecha</label>
                        <input
                            type="date"
                            id="task-date-input"
                            class="task-input-control"
                            bind:value={taskDate}
                        />
                    </div>
                {/if}
                <div class="task-input-form-group">
                    <label for="task-time-input">Hora</label>
                    <input
                        type="time"
                        id="task-time-input"
                        class="task-input-control"
                        bind:value={time}
                    />
                </div>
            </div>

            <div class="task-input-form-group">
                <p id="priority-label">Prioridad</p>
                <div
                    class="priority-selector"
                    role="radiogroup"
                    aria-labelledby="priority-label"
                >
                    <button
                        type="button"
                        class="priority-option {priority === 1
                            ? 'selected'
                            : ''}"
                        aria-pressed={priority === 1}
                        on:click={() => (priority = 1)}
                    >
                        <span class="priority-dot high"></span> Alta
                    </button>
                    <button
                        type="button"
                        class="priority-option {priority === 2
                            ? 'selected'
                            : ''}"
                        aria-pressed={priority === 2}
                        on:click={() => (priority = 2)}
                    >
                        <span class="priority-dot medium"></span> Media
                    </button>
                    <button
                        type="button"
                        class="priority-option {priority === 3
                            ? 'selected'
                            : ''}"
                        aria-pressed={priority === 3}
                        on:click={() => (priority = 3)}
                    >
                        <span class="priority-dot low"></span> Baja
                    </button>
                </div>
            </div>

            <div class="task-input-form-group">
                <label for="task-tags-input">Etiquetas</label>
                <div class="tags-input-wrapper">
                    <div id="tags-chips" class="tags-chips">
                        {#each tags as tag}
                            <span class="tag-chip" data-tag={tag}>
                                {tag}
                                <button
                                    type="button"
                                    class="tag-remove"
                                    aria-label="Quitar"
                                    on:click={() => removeTag(tag)}
                                    >&times;</button
                                >
                            </span>
                        {/each}
                    </div>
                    <input
                        type="text"
                        id="task-tags-input"
                        placeholder="Escribe y presiona Enter"
                        class="task-input-control tags-text-input"
                        bind:value={currentTagInput}
                        on:keydown={handleAddTag}
                    />
                </div>
                <small class="tags-hint"
                    >Separa etiquetas con Enter o coma</small
                >
            </div>

            {#if !existingTask}
                <div class="task-input-form-group">
                    <label for="task-recurrence-input">Repetir</label>
                    <select
                        id="task-recurrence-input"
                        class="task-input-control"
                        bind:value={recurrence}
                    >
                        <option value="">No repetir</option>
                        <option value="daily">Diariamente</option>
                        <option value="weekly">Semanalmente</option>
                        <option value="monthly">Mensualmente</option>
                        <option value="yearly">Anualmente</option>
                    </select>
                </div>
            {/if}

            <div class="task-input-form-group task-input-checkbox">
                <label>
                    <input
                        type="checkbox"
                        id="task-reminder-input"
                        bind:checked={isReminder}
                    />
                    <span>{@html icons.bell}</span>
                    <span>Recordatorio</span>
                </label>
            </div>

            <div class="task-input-actions">
                <button
                    type="button"
                    class="task-input-cancel-btn"
                    on:click={close}>Cancelar</button
                >
                <button
                    type="button"
                    class="task-input-save-btn"
                    on:click={saveTask}
                >
                    {existingTask ? "Actualizar" : "Guardar"}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .view-svelte-modal {
        display: flex;
        z-index: 1000;
    }
</style>
