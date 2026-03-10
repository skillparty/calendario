<script lang="ts">
    import { onMount } from "svelte";
    import { fade, fly } from "svelte/transition";
    import {
        userSessionStore,
        groupsStore,
        setGroups,
        addGroup,
        removeGroup,
        setActiveGroup,
    } from "../store/state";
    import { API_BASE_URL } from "../services/api";
    import { showToast } from "../utils/UIFeedback";
    import GroupModal from "../components/GroupModal.svelte";
    import GroupTaskCard from "../components/GroupTaskCard.svelte";
    import GroupCalendar from "./GroupCalendar.svelte";
    import type { Group, GroupMember, GroupTask } from "../types";

    // ── State ─────────────────────────────────────────────────────────────────
    let groups: Group[] = [];
    let loading = true;
    let error: string | null = null;

    // Selected group detail
    let activeGroup: (Group & { group_members?: GroupMember[] }) | null = null;
    let groupTasks: any[] = [];
    let groupTasksLoading = false;
    let detailView: "kanban" | "calendar" = "kanban";

    // Modals
    let showCreateModal = false;
    let showJoinModal = false;
    let newGroupName = "";
    let newGroupDesc = "";
    let inviteCode = "";
    let creating = false;
    let joining = false;

    $: jwt = $userSessionStore?.jwt || $userSessionStore?.token;
    $: isLoggedIn = !!jwt;

    // ── API helpers ─────────────────────────────────────────────────────────

    async function apiFetch(path: string, opts: RequestInit = {}) {
        let res: Response;
        try {
            res = await fetch(API_BASE_URL + path, {
                ...opts,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${jwt}`,
                    ...(opts.headers || {}),
                },
            });
        } catch {
            throw new Error("No se pudo conectar al servidor. Verifica tu conexión.");
        }
        let data: any;
        try {
            data = await res.json();
        } catch {
            throw new Error(`Error del servidor (${res.status})`);
        }
        if (!res.ok) throw new Error(data?.error || "Error en la petición");
        return data;
    }

    async function loadGroups() {
        if (!jwt) return;
        loading = true;
        error = null;
        try {
            const res = await apiFetch("/api/groups");
            groups = res.data || [];
        } catch (e: any) {
            error = e.message;
        } finally {
            loading = false;
        }
    }

    async function openGroup(group: Group) {
        activeGroup = group as any;
        detailView = "kanban";
        groupTasksLoading = true;
        try {
            const [detail, tasksRes] = await Promise.all([
                apiFetch(`/api/groups/${group.id}`),
                apiFetch(`/api/groups/${group.id}/tasks`),
            ]);
            activeGroup = detail.data;
            groupTasks = tasksRes.data || [];
        } catch (e: any) {
            showToast("Error cargando grupo", { type: "error" });
        } finally {
            groupTasksLoading = false;
        }
    }

    async function createGroup() {
        if (!newGroupName.trim()) return;
        creating = true;
        try {
            const res = await apiFetch("/api/groups", {
                method: "POST",
                body: JSON.stringify({
                    name: newGroupName.trim(),
                    description: newGroupDesc.trim() || undefined,
                }),
            });
            groups = [res.data, ...groups];
            showToast("Grupo creado ✓", { type: "success" });
            showCreateModal = false;
            newGroupName = "";
            newGroupDesc = "";
            openGroup(res.data);
        } catch (e: any) {
            showToast(e.message, { type: "error" });
        } finally {
            creating = false;
        }
    }

    async function joinGroup() {
        if (!inviteCode.trim()) return;
        joining = true;
        try {
            const res = await apiFetch("/api/groups/join", {
                method: "POST",
                body: JSON.stringify({
                    invite_code: inviteCode.trim().toUpperCase(),
                }),
            });
            await loadGroups();
            showToast(
                res.already_member
                    ? "Ya eres miembro"
                    : `Te uniste a ${res.data?.name} ✓`,
                { type: "success" },
            );
            showJoinModal = false;
            inviteCode = "";
        } catch (e: any) {
            showToast(e.message, { type: "error" });
        } finally {
            joining = false;
        }
    }

    async function leaveGroup(groupId: number) {
        if (!confirm("¿Salir del grupo?")) return;
        try {
            const userId = ($userSessionStore?.user as any)?.id;
            await apiFetch(`/api/groups/${groupId}/members/${userId}`, {
                method: "DELETE",
            });
            groups = groups.filter((g) => g.id !== groupId);
            if (activeGroup?.id === groupId) activeGroup = null;
            showToast("Saliste del grupo", { type: "success" });
        } catch (e: any) {
            showToast(e.message, { type: "error" });
        }
    }

    async function deleteGroup(groupId: number) {
        if (
            !confirm(
                "¿Eliminar el grupo permanentemente? Esta acción no se puede deshacer.",
            )
        )
            return;
        try {
            await apiFetch(`/api/groups/${groupId}`, { method: "DELETE" });
            groups = groups.filter((g) => g.id !== groupId);
            if (activeGroup?.id === groupId) activeGroup = null;
            showToast("Grupo eliminado", { type: "success" });
        } catch (e: any) {
            showToast(e.message, { type: "error" });
        }
    }

    async function updateTaskStatus(taskId: string | number, status: string) {
        if (!activeGroup) return;
        try {
            await apiFetch(
                `/api/groups/${activeGroup.id}/tasks/${taskId}/status`,
                {
                    method: "PATCH",
                    body: JSON.stringify({ task_status: status }),
                },
            );
            groupTasks = groupTasks.map((t) =>
                String(t.id) === String(taskId)
                    ? { ...t, task_status: status }
                    : t,
            );
            showToast("Estado actualizado", {
                type: "success",
                duration: 1500,
            });
        } catch (e: any) {
            showToast(e.message, { type: "error" });
        }
    }

    onMount(() => {
        if (isLoggedIn) loadGroups();
    });

    // ── UI Helpers ────────────────────────────────────────────────────────────
    const ROLE_LABELS: Record<string, string> = {
        owner: "Dueño",
        admin: "Admin",
        member: "Miembro",
    };
    const STATUS_LABELS: Record<string, string> = {
        todo: "Pendiente",
        in_progress: "En progreso",
        done: "Hecho",
        blocked: "Bloqueado",
    };
    const STATUS_COLORS: Record<string, string> = {
        todo: "var(--text-secondary)",
        in_progress: "#e6a817",
        done: "#22c55e",
        blocked: "#e53e3e",
    };

    function copyCode(code: string) {
        navigator.clipboard.writeText(code).then(() =>
            showToast("Código copiado", {
                type: "success",
                duration: 1500,
            }),
        );
    }
</script>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="groups-view" in:fade={{ duration: 150 }}>
    <!-- ── Header / Hero ─────────────────────────────────────────────────── -->
    <div class="groups-header">
        <div class="groups-header-inner">
            <div class="groups-title-block">
                <h1 class="groups-title">
                    <span class="groups-icon">👥</span>
                    Grupos
                </h1>
                <p class="groups-subtitle">
                    Colabora en calendarios compartidos
                </p>
            </div>
            {#if isLoggedIn}
                <div class="groups-actions">
                    <button
                        class="btn-join"
                        on:click={() => (showJoinModal = true)}
                    >
                        Unirse
                    </button>
                    <button
                        class="btn-create"
                        on:click={() => (showCreateModal = true)}
                    >
                        + Nuevo grupo
                    </button>
                </div>
            {/if}
        </div>
    </div>

    <!-- ── Not logged in ─────────────────────────────────────────────────── -->
    {#if !isLoggedIn}
        <div class="groups-empty" in:fade>
            <div class="empty-icon">🔒</div>
            <h3>Inicia sesión para usar grupos</h3>
            <p>La colaboración en grupos requiere una cuenta de GitHub.</p>
        </div>
    {:else if loading}
        <div class="groups-loading">
            <div class="spinner"></div>
            <span>Cargando grupos…</span>
        </div>
    {:else if error}
        <div class="groups-error">
            <p>❌ {error}</p>
            <button on:click={loadGroups}>Reintentar</button>
        </div>
    {:else}
        <div class="groups-layout">
            <!-- ── Group List ────────────────────────────────────────────── -->
            <aside class="groups-sidebar">
                {#if groups.length === 0}
                    <div class="groups-empty-small">
                        <div class="empty-icon-sm">📭</div>
                        <p>No perteneces a ningún grupo aún.</p>
                        <p>Crea uno o únete con un código de invitación.</p>
                    </div>
                {:else}
                    <div class="groups-list">
                        {#each groups as group (group.id)}
                            <!-- svelte-ignore a11y-no-static-element-interactions -->
                            <div
                                class="group-card {activeGroup?.id === group.id
                                    ? 'active'
                                    : ''}"
                                on:click={() => openGroup(group)}
                                on:keydown={(e) =>
                                    e.key === "Enter" && openGroup(group)}
                                role="button"
                                tabindex="0"
                                in:fly={{ y: 12, duration: 200 }}
                            >
                                <div class="group-card-avatar">
                                    {group.name.charAt(0).toUpperCase()}
                                </div>
                                <div class="group-card-info">
                                    <span class="group-card-name"
                                        >{group.name}</span
                                    >
                                    <span class="group-card-meta">
                                        {group.member_count ?? "?"} miembros · {ROLE_LABELS[
                                            group.my_role ?? "member"
                                        ]}
                                    </span>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </aside>

            <!-- ── Group Detail ──────────────────────────────────────────── -->
            <main class="group-detail">
                {#if !activeGroup}
                    <div class="group-detail-empty">
                        <span class="detail-empty-icon">👈</span>
                        <p>Selecciona un grupo para ver sus detalles</p>
                    </div>
                {:else}
                    <div class="group-detail-inner" in:fade={{ duration: 150 }}>
                        <!-- Detail Header -->
                        <div class="detail-header">
                            <div class="detail-title-block">
                                <h2 class="detail-title">{activeGroup.name}</h2>
                                {#if activeGroup.description}
                                    <p class="detail-desc">
                                        {activeGroup.description}
                                    </p>
                                {/if}
                            </div>
                            <div class="detail-header-actions">
                                <!-- 📅 Navigate to GroupCalendar -->
                                <button
                                    class="btn-calendar"
                                    title="Ver calendario del grupo"
                                    on:click={() => {
                                        setActiveGroup(activeGroup!.id);
                                        window.dispatchEvent(
                                            new CustomEvent("navigateTo", {
                                                detail: "group-calendar",
                                            }),
                                        );
                                    }}>📅 Calendario</button
                                >
                                {#if activeGroup.invite_code}
                                    <button
                                        class="btn-code"
                                        title="Copiar código de invitación"
                                        on:click={() =>
                                            copyCode(
                                                activeGroup?.invite_code ?? "",
                                            )}
                                    >
                                        🔗 {activeGroup.invite_code}
                                    </button>
                                {/if}
                                {#if activeGroup.my_role === "owner"}
                                    <button
                                        class="btn-danger-sm"
                                        on:click={() =>
                                            deleteGroup(activeGroup!.id)}
                                    >
                                        Eliminar
                                    </button>
                                {:else}
                                    <button
                                        class="btn-leave"
                                        on:click={() =>
                                            leaveGroup(activeGroup!.id)}
                                    >
                                        Salir
                                    </button>
                                {/if}
                            </div>
                        </div>

                        <!-- Members -->
                        <section class="detail-section">
                            <h3 class="section-title">👤 Miembros</h3>
                            <div class="members-list">
                                {#each activeGroup.group_members ?? [] as m (m.user_id)}
                                    <div class="member-chip">
                                        <img
                                            src={m.users?.avatar_url ||
                                                "/app.png"}
                                            alt={m.users?.username ?? ""}
                                            class="member-avatar"
                                        />
                                        <span class="member-name"
                                            >{m.users?.name ||
                                                m.users?.username ||
                                                "Usuario"}</span
                                        >
                                        <span class="member-role role-{m.role}"
                                            >{ROLE_LABELS[m.role]}</span
                                        >
                                    </div>
                                {/each}
                            </div>
                        </section>

                        <!-- Group Tasks Kanban -->
                        <section class="detail-section">
                            <div class="section-header-row">
                                <h3 class="section-title">
                                    {detailView === "kanban"
                                        ? "📋 Tareas del grupo"
                                        : "🗓️ Calendario del grupo"}
                                </h3>
                                <div class="detail-view-switch" role="tablist">
                                    <button
                                        type="button"
                                        role="tab"
                                        class="view-tab {detailView === 'kanban'
                                            ? 'active'
                                            : ''}"
                                        aria-selected={detailView === "kanban"}
                                        on:click={() => (detailView = "kanban")}
                                    >
                                        Kanban
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        class="view-tab {detailView ===
                                        'calendar'
                                            ? 'active'
                                            : ''}"
                                        aria-selected={detailView ===
                                            "calendar"}
                                        on:click={() =>
                                            (detailView = "calendar")}
                                    >
                                        Calendario
                                    </button>
                                </div>
                            </div>

                            {#if detailView === "calendar"}
                                <div class="group-calendar-shell">
                                    <GroupCalendar />
                                </div>
                            {:else if groupTasksLoading}
                                <div class="tasks-loading">
                                    Cargando tareas…
                                </div>
                            {:else if groupTasks.length === 0}
                                <p class="tasks-empty">
                                    No hay tareas en este grupo aún.
                                </p>
                            {:else}
                                <div class="kanban-board">
                                    {#each ["todo", "in_progress", "done", "blocked"] as col}
                                        <div class="kanban-col">
                                            <div
                                                class="kanban-col-header"
                                                style="--col-color: {STATUS_COLORS[
                                                    col
                                                ]}"
                                            >
                                                {STATUS_LABELS[col]}
                                                <span class="kanban-count">
                                                    {groupTasks.filter(
                                                        (t) =>
                                                            (t.task_status ??
                                                                "todo") === col,
                                                    ).length}
                                                </span>
                                            </div>
                                            <div class="kanban-cards">
                                                {#each groupTasks.filter((t) => (t.task_status ?? "todo") === col) as task (task.id)}
                                                    <GroupTaskCard
                                                        {task}
                                                        showDate={false}
                                                        on:statusChange={(e) =>
                                                            updateTaskStatus(
                                                                e.detail.id,
                                                                e.detail.status,
                                                            )}
                                                    />
                                                {/each}
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </section>
                    </div>
                {/if}
            </main>
        </div>
    {/if}
</div>

<GroupModal
    visible={showCreateModal}
    mode="create"
    on:close={() => (showCreateModal = false)}
    on:saved={(e) => {
        groups = [e.detail, ...groups];
        setGroups(groups);
        openGroup(e.detail);
    }}
/>

<GroupModal
    visible={showJoinModal}
    mode="join"
    on:close={() => (showJoinModal = false)}
    on:joined={async () => {
        await loadGroups();
    }}
/>

<style>
    /* ── Layout ─────────────────────────────────────────────────────────── */
    .groups-view {
        display: flex;
        flex-direction: column;
        min-height: 100%;
        padding-bottom: var(--bottom-nav-clearance, 100px);
    }

    .groups-header {
        background: linear-gradient(
            135deg,
            var(--app-accent, #0066cc) 0%,
            color-mix(in srgb, var(--app-accent, #0066cc) 70%, #6366f1) 100%
        );
        padding: 2rem 1.5rem 2.5rem;
        color: white;
    }

    .groups-header-inner {
        max-width: 900px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
    }

    .groups-title {
        font-size: 1.75rem;
        font-weight: 800;
        margin: 0 0 0.25rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .groups-subtitle {
        margin: 0;
        opacity: 0.85;
        font-size: 0.95rem;
    }

    .groups-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .btn-create {
        background: white;
        color: var(--app-accent, #0066cc);
        border: none;
        padding: 0.6rem 1.2rem;
        border-radius: var(--radius-pill, 32px);
        font-weight: 700;
        cursor: pointer;
        font-size: 0.9rem;
        transition:
            transform 0.15s,
            box-shadow 0.15s;
    }

    .btn-create:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .btn-create:active {
        transform: scale(0.96);
    }

    .btn-join {
        background: rgba(255, 255, 255, 0.18);
        color: white;
        border: 1.5px solid rgba(255, 255, 255, 0.5);
        padding: 0.6rem 1.2rem;
        border-radius: var(--radius-pill, 32px);
        font-weight: 600;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background 0.15s;
        backdrop-filter: blur(8px);
    }
    .btn-join:hover {
        background: rgba(255, 255, 255, 0.28);
    }

    /* ── Main layout ──────────────────────────────────────────────────── */
    .groups-layout {
        display: grid;
        grid-template-columns: 280px 1fr;
        gap: 0;
        max-width: 1100px;
        margin: 0 auto;
        width: 100%;
        flex: 1;
        min-height: 0;
    }

    /* ── Sidebar ──────────────────────────────────────────────────────── */
    .groups-sidebar {
        border-right: 1px solid var(--border-color);
        padding: 1rem 0;
        overflow-y: auto;
    }

    .groups-list {
        list-style: none;
        margin: 0;
        padding: 0 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .group-card {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        border-radius: var(--radius-md, 12px);
        cursor: pointer;
        transition: background 0.15s;
        border: 1px solid transparent;
    }

    .group-card:hover {
        background: var(--bg-secondary);
    }
    .group-card.active {
        background: color-mix(
            in srgb,
            var(--app-accent, #0066cc) 10%,
            transparent
        );
        border-color: color-mix(
            in srgb,
            var(--app-accent, #0066cc) 25%,
            transparent
        );
    }

    .group-card-avatar {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: linear-gradient(
            135deg,
            var(--app-accent, #0066cc),
            color-mix(in srgb, var(--app-accent) 60%, #6366f1)
        );
        color: white;
        font-weight: 800;
        font-size: 1.1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .group-card-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }
    .group-card-name {
        font-weight: 600;
        font-size: 0.9rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .group-card-meta {
        font-size: 0.75rem;
        color: var(--text-secondary);
    }

    /* ── Detail ───────────────────────────────────────────────────────── */
    .group-detail {
        padding: 1.5rem;
        overflow-y: auto;
    }

    .group-detail-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        min-height: 200px;
        color: var(--text-secondary);
        gap: 0.5rem;
        text-align: center;
    }

    .detail-empty-icon {
        font-size: 2rem;
    }

    .detail-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
    }

    .detail-title {
        margin: 0 0 0.25rem;
        font-size: 1.5rem;
    }
    .detail-desc {
        margin: 0;
        color: var(--text-secondary);
        font-size: 0.9rem;
    }

    .detail-header-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        align-items: center;
    }

    .btn-calendar {
        font-size: 0.85rem;
        font-weight: 600;
        padding: 0.4rem 0.75rem;
        border-radius: var(--radius-md);
        border: 1.5px solid var(--app-accent, #0066cc);
        color: var(--app-accent, #0066cc);
        background: color-mix(
            in srgb,
            var(--app-accent, #0066cc) 8%,
            transparent
        );
        cursor: pointer;
        transition: background 0.15s;
        white-space: nowrap;
    }
    .btn-calendar:hover {
        background: color-mix(
            in srgb,
            var(--app-accent, #0066cc) 18%,
            transparent
        );
    }

    .btn-code {
        font-family: monospace;
        font-size: 0.85rem;
        font-weight: 700;
        padding: 0.4rem 0.75rem;
        border-radius: var(--radius-pill);
        border: 1.5px dashed var(--app-accent, #0066cc);
        color: var(--app-accent, #0066cc);
        background: color-mix(
            in srgb,
            var(--app-accent, #0066cc) 8%,
            transparent
        );
        cursor: pointer;
        transition: background 0.15s;
    }
    .btn-code:hover {
        background: color-mix(
            in srgb,
            var(--app-accent, #0066cc) 15%,
            transparent
        );
    }

    .btn-danger-sm,
    .btn-leave {
        padding: 0.4rem 0.8rem;
        border-radius: var(--radius-md);
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: opacity 0.15s;
    }
    .btn-danger-sm {
        background: #fee2e2;
        color: #dc2626;
    }
    .btn-leave {
        background: var(--bg-tertiary);
        color: var(--text-secondary);
    }
    .btn-danger-sm:hover,
    .btn-leave:hover {
        opacity: 0.8;
    }

    /* ── Sections ───────────────────────────────────────────────────── */
    .detail-section {
        margin-bottom: 2rem;
    }
    .section-title {
        font-size: 1rem;
        font-weight: 700;
        margin: 0 0 0.75rem;
    }

    .section-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
        flex-wrap: wrap;
    }

    .section-header-row .section-title {
        margin: 0;
    }

    .detail-view-switch {
        display: inline-flex;
        gap: 0.35rem;
        padding: 0.25rem;
        border-radius: 999px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
    }

    .view-tab {
        border: none;
        background: transparent;
        color: var(--text-secondary);
        font-size: 0.78rem;
        font-weight: 700;
        padding: 0.35rem 0.7rem;
        border-radius: 999px;
        cursor: pointer;
    }

    .view-tab.active {
        background: var(--bg-primary);
        color: var(--text-primary);
        box-shadow: var(--shadow-sm);
    }

    .group-calendar-shell {
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md, 12px);
        background: var(--bg-primary);
        overflow: hidden;
    }

    /* ── Members ────────────────────────────────────────────────────── */
    .members-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .member-chip {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.75rem 0.4rem 0.4rem;
        border-radius: var(--radius-pill);
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
    }

    .member-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        object-fit: cover;
    }
    .member-name {
        font-size: 0.85rem;
        font-weight: 500;
    }
    .member-role {
        font-size: 0.7rem;
        padding: 0.15rem 0.45rem;
        border-radius: 999px;
        font-weight: 700;
    }
    .role-owner {
        background: #fef3c7;
        color: #d97706;
    }
    .role-admin {
        background: #ede9fe;
        color: #7c3aed;
    }
    .role-member {
        background: var(--bg-tertiary);
        color: var(--text-secondary);
    }

    /* ── Kanban Board ───────────────────────────────────────────────── */
    .kanban-board {
        display: grid;
        grid-template-columns: repeat(4, minmax(140px, 1fr));
        gap: 0.75rem;
        overflow-x: auto;
    }

    .kanban-col {
        background: var(--bg-secondary);
        border-radius: var(--radius-md, 12px);
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .kanban-col-header {
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--col-color, var(--text-secondary));
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.25rem;
    }

    .kanban-count {
        background: var(--bg-tertiary);
        border-radius: 999px;
        padding: 0.1rem 0.45rem;
        font-size: 0.7rem;
        color: var(--text-secondary);
    }

    .kanban-cards {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    /* ── Empty / Loading states ───────────────────────────────────────── */
    .groups-empty,
    .groups-loading,
    .groups-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3rem 1rem;
        gap: 0.75rem;
        text-align: center;
        color: var(--text-secondary);
    }

    .empty-icon {
        font-size: 2.5rem;
    }
    .groups-empty h3 {
        margin: 0;
        font-size: 1.15rem;
        color: var(--text-primary);
    }
    .groups-empty p {
        margin: 0;
        font-size: 0.9rem;
    }

    .groups-empty-small {
        padding: 2rem 1rem;
        text-align: center;
        color: var(--text-secondary);
        font-size: 0.85rem;
    }
    .empty-icon-sm {
        font-size: 1.75rem;
        margin-bottom: 0.5rem;
    }

    .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--border-color);
        border-top-color: var(--app-accent, #0066cc);
        border-radius: 50%;
        animation: spin 0.75s linear infinite;
    }
    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .tasks-loading {
        color: var(--text-secondary);
        font-size: 0.9rem;
    }
    .tasks-empty {
        color: var(--text-secondary);
        font-size: 0.9rem;
        margin: 0;
    }

    /* ── Modal shared styles (reuse existing .modal-content, .task-input-*) */
    .group-modal-content {
        max-width: 440px;
    }

    /* ── Mobile ───────────────────────────────────────────────────────── */
    @media (max-width: 768px) {
        .groups-layout {
            grid-template-columns: 1fr;
        }

        .groups-sidebar {
            border-right: none;
            border-bottom: 1px solid var(--border-color);
            padding: 0.75rem 0;
        }

        .groups-header {
            padding: 1.25rem 1rem 1.75rem;
        }

        .groups-title {
            font-size: 1.35rem;
        }

        /* On mobile show sidebar as horizontal scroll list */
        .groups-list {
            flex-direction: row;
            overflow-x: auto;
            padding: 0.25rem 1rem;
            gap: 0.5rem;
            flex-wrap: nowrap;
            -webkit-overflow-scrolling: touch;
        }

        .group-card {
            flex-shrink: 0;
            min-width: 160px;
            max-width: 200px;
        }

        .kanban-board {
            grid-template-columns: repeat(4, 140px);
        }

        .group-detail {
            padding: 1rem;
        }
    }
</style>
