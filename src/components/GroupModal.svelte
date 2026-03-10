<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { fade, scale } from "svelte/transition";
    import { userSessionStore } from "../store/state";
    import { addGroup, setActiveGroup, removeGroup } from "../store/state";
    import { API_BASE_URL } from "../services/api";
    import { showToast } from "../utils/UIFeedback";
    import type { Group } from "../types";

    // ── Props ─────────────────────────────────────────────────────────────────
    /**
     * mode:
     *   "create" — blank form to create a new group
     *   "join"   — invite-code input to join an existing group
     *   "edit"   — edit name/description of an existing group (requires group prop)
     */
    export let visible = false;
    export let mode: "create" | "join" | "edit" = "create";
    export let group: Group | null = null; // required when mode="edit"

    // Exposed form fields (two-way bindable for parent convenience)
    export let groupName = "";
    export let groupDescription = "";
    export let inviteCode = "";

    // ── Internal state ────────────────────────────────────────────────────────
    let loading = false;

    const dispatch = createEventDispatcher<{
        close: void;
        saved: Group;
        joined: Group;
    }>();

    $: jwt = $userSessionStore?.jwt ?? ($userSessionStore as any)?.token ?? "";

    // Sync form from group prop when switching to edit mode
    $: if (visible && mode === "edit" && group) {
        groupName = group.name;
        groupDescription = group.description ?? "";
    }

    $: submitDisabled =
        mode === "join"
            ? loading || inviteCode.trim().length < 4
            : loading || !groupName.trim();

    // ── API helper ────────────────────────────────────────────────────────────
    async function apiFetch(path: string, init: RequestInit = {}) {
        const res = await fetch(API_BASE_URL + path, {
            ...init,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${jwt}`,
                ...(init.headers ?? {}),
            },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Error");
        return data;
    }

    // ── Actions ───────────────────────────────────────────────────────────────
    async function submit() {
        if (submitDisabled) return;
        loading = true;
        try {
            if (mode === "create") {
                const res = await apiFetch("/api/groups", {
                    method: "POST",
                    body: JSON.stringify({
                        name: groupName.trim(),
                        description: groupDescription.trim() || undefined,
                    }),
                });
                addGroup(res.data);
                setActiveGroup(res.data.id);
                showToast("Grupo creado ✓", { type: "success" });
                dispatch("saved", res.data);
                close();
            } else if (mode === "join") {
                const res = await apiFetch("/api/groups/join", {
                    method: "POST",
                    body: JSON.stringify({
                        invite_code: inviteCode.trim().toUpperCase(),
                    }),
                });
                showToast(
                    res.already_member
                        ? "Ya eres miembro"
                        : `Te uniste a ${res.data?.name} ✓`,
                    { type: "success" },
                );
                dispatch("joined", res.data);
                close();
            } else if (mode === "edit" && group) {
                const res = await apiFetch(`/api/groups/${group.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        name: groupName.trim(),
                        description: groupDescription.trim() || undefined,
                    }),
                });
                showToast("Grupo actualizado ✓", { type: "success" });
                dispatch("saved", res.data);
                close();
            }
        } catch (e: any) {
            showToast(e.message, { type: "error" });
        } finally {
            loading = false;
        }
    }

    function close() {
        groupName = "";
        groupDescription = "";
        inviteCode = "";
        dispatch("close");
    }

    function onBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) close();
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") close();
        if (e.key === "Enter") submit();
    }
</script>

{#if visible}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class="modal view-svelte-modal"
        transition:fade={{ duration: 150 }}
        on:click={onBackdropClick}
        on:keydown={onKeydown}
    >
        <div
            class="modal-content group-modal-content"
            role="dialog"
            aria-modal="true"
            in:scale={{ duration: 250, start: 0.96 }}
        >
            <div class="modal-drag-handle" aria-hidden="true"></div>
            <button class="close-btn" on:click={close}>&times;</button>

            <!-- ── CREATE mode ── -->
            {#if mode === "create"}
                <h3>✨ Nuevo grupo</h3>
                <div class="task-input-form-group">
                    <label for="group-name-input">Nombre del grupo</label>
                    <input
                        id="group-name-input"
                        type="text"
                        class="task-input-control"
                        placeholder="Ej: Equipo de Marketing"
                        maxlength="255"
                        bind:value={groupName}
                        autocomplete="off"
                    />
                </div>
                <div class="task-input-form-group">
                    <label for="group-desc-input">
                        Descripción <span class="optional">(opcional)</span>
                    </label>
                    <textarea
                        id="group-desc-input"
                        class="task-input-control"
                        rows="2"
                        placeholder="¿Para qué usarán este calendario?"
                        maxlength="1000"
                        bind:value={groupDescription}
                    ></textarea>
                </div>
                <div class="task-input-actions">
                    <button class="task-input-cancel-btn" on:click={close}
                        >Cancelar</button
                    >
                    <button
                        class="task-input-save-btn"
                        on:click={submit}
                        disabled={submitDisabled}
                    >
                        {loading ? "Creando…" : "Crear grupo"}
                    </button>
                </div>

                <!-- ── JOIN mode ── -->
            {:else if mode === "join"}
                <h3>🔗 Unirse a un grupo</h3>
                <p class="join-hint">
                    Pide el código al administrador del grupo.
                </p>
                <div class="task-input-form-group">
                    <label for="invite-code-input">Código de invitación</label>
                    <input
                        id="invite-code-input"
                        type="text"
                        class="task-input-control invite-code-input"
                        placeholder="ABCD1234"
                        maxlength="8"
                        bind:value={inviteCode}
                        on:input={() => (inviteCode = inviteCode.toUpperCase())}
                    />
                </div>
                <div class="task-input-actions">
                    <button class="task-input-cancel-btn" on:click={close}
                        >Cancelar</button
                    >
                    <button
                        class="task-input-save-btn"
                        on:click={submit}
                        disabled={submitDisabled}
                    >
                        {loading ? "Uniéndose…" : "Unirse"}
                    </button>
                </div>

                <!-- ── EDIT mode ── -->
            {:else}
                <h3>✏️ Editar grupo</h3>
                <div class="task-input-form-group">
                    <label for="edit-group-name">Nombre del grupo</label>
                    <input
                        id="edit-group-name"
                        type="text"
                        class="task-input-control"
                        maxlength="255"
                        bind:value={groupName}
                        autocomplete="off"
                    />
                </div>
                <div class="task-input-form-group">
                    <label for="edit-group-desc">
                        Descripción <span class="optional">(opcional)</span>
                    </label>
                    <textarea
                        id="edit-group-desc"
                        class="task-input-control"
                        rows="2"
                        maxlength="1000"
                        bind:value={groupDescription}
                    ></textarea>
                </div>

                {#if group?.invite_code}
                    <div class="invite-info">
                        <span class="invite-label">Código:</span>
                        <code class="invite-code-display"
                            >{group.invite_code}</code
                        >
                        <button
                            class="btn-copy"
                            on:click={() => {
                                navigator.clipboard.writeText(
                                    group?.invite_code ?? "",
                                );
                                showToast("Código copiado", {
                                    type: "success",
                                    duration: 1500,
                                });
                            }}>Copiar</button
                        >
                    </div>
                {/if}

                <div class="task-input-actions">
                    <button class="task-input-cancel-btn" on:click={close}
                        >Cancelar</button
                    >
                    <button
                        class="task-input-save-btn"
                        on:click={submit}
                        disabled={submitDisabled}
                    >
                        {loading ? "Guardando…" : "Guardar"}
                    </button>
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .optional {
        font-weight: 400;
        color: var(--text-secondary);
        font-size: 0.8rem;
    }

    .join-hint {
        margin: 0 0 0.75rem;
        color: var(--text-secondary);
        font-size: 0.9rem;
    }

    .invite-code-input {
        text-transform: uppercase;
        letter-spacing: 0.15em;
        font-weight: 700;
        text-align: center;
        font-size: 1.1rem !important;
    }

    .invite-info {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.5rem 0.8rem;
        background: var(--bg-secondary);
        border-radius: 10px;
        border: 1px dashed var(--border-color);
        font-size: 0.85rem;
    }

    .invite-label {
        color: var(--text-secondary);
    }

    .invite-code-display {
        font-family: monospace;
        font-size: 1rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        color: var(--app-accent, #0066cc);
    }

    .btn-copy {
        margin-left: auto;
        font-size: 0.78rem;
        padding: 0.2rem 0.6rem;
        border: 1px solid var(--app-accent, #0066cc);
        color: var(--app-accent, #0066cc);
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
        transition: background 0.12s;
    }

    .btn-copy:hover {
        background: color-mix(
            in srgb,
            var(--app-accent, #0066cc) 10%,
            transparent
        );
    }
</style>
