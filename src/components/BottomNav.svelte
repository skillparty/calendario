<script lang="ts">
    import { icons } from "./icons";
    export let view:
        | "calendar"
        | "agenda"
        | "weekly"
        | "groups"
        | "group-calendar" = "calendar";

    function handleNavClick(
        newView: "calendar" | "agenda" | "weekly" | "groups" | "group-calendar",
    ) {
        view = newView;
        if (navigator.vibrate) navigator.vibrate(8);
    }
</script>

<nav class="bottom-nav-mobile" aria-label="Navegación principal">
    <button
        type="button"
        id="bottom-calendar-btn"
        class="bottom-nav-item {view === 'calendar' ? 'active' : ''}"
        on:click={() => handleNavClick("calendar")}
        aria-pressed={view === "calendar"}
        aria-current={view === "calendar" ? "page" : undefined}
        aria-label="Ir a Calendario"
    >
        <span class="nav-pill-bg"></span>
        <span class="nav-icon">{@html icons.calendar}</span>
        <span class="nav-text">Calendario</span>
    </button>
    <button
        type="button"
        id="bottom-agenda-btn"
        class="bottom-nav-item {view === 'agenda' ? 'active' : ''}"
        on:click={() => handleNavClick("agenda")}
        aria-pressed={view === "agenda"}
        aria-current={view === "agenda" ? "page" : undefined}
        aria-label="Ir a Agenda"
    >
        <span class="nav-pill-bg"></span>
        <span class="nav-icon">{@html icons.agenda}</span>
        <span class="nav-text">Agenda</span>
    </button>
    <button
        type="button"
        id="bottom-weekly-btn"
        class="bottom-nav-item {view === 'weekly' ? 'active' : ''}"
        on:click={() => handleNavClick("weekly")}
        aria-pressed={view === "weekly"}
        aria-current={view === "weekly" ? "page" : undefined}
        aria-label="Ir a Semanal"
    >
        <span class="nav-pill-bg"></span>
        <span class="nav-icon">{@html icons.weekly}</span>
        <span class="nav-text">Semanal</span>
    </button>
    <button
        type="button"
        id="bottom-groups-btn"
        class="bottom-nav-item {view === 'groups' ? 'active' : ''}"
        on:click={() => handleNavClick("groups")}
        aria-pressed={view === "groups"}
        aria-current={view === "groups" ? "page" : undefined}
        aria-label="Ir a Grupos"
    >
        <span class="nav-pill-bg"></span>
        <span class="nav-icon">{@html icons.user ?? "👥"}</span>
        <span class="nav-text">Grupos</span>
    </button>
</nav>

<style>
    /* Scoped pill background for active tab */
    .nav-pill-bg {
        position: absolute;
        inset: 4px 6px;
        border-radius: 14px;
        background: transparent;
        transition:
            background 0.22s ease,
            transform 0.22s ease;
        z-index: 0;
        pointer-events: none;
    }

    .bottom-nav-item {
        position: relative;
        overflow: hidden;
    }

    .bottom-nav-item.active .nav-pill-bg {
        background: color-mix(
            in srgb,
            var(--app-accent, #0066cc) 14%,
            transparent
        );
    }

    .bottom-nav-item .nav-icon,
    .bottom-nav-item .nav-text {
        position: relative;
        z-index: 1;
    }

    /* Press scale effect */
    .bottom-nav-item:active {
        transform: scale(0.94);
    }
</style>
