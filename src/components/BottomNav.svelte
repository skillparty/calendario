<script lang="ts">
    import { icons } from "./icons";
    export let view: "calendar" | "agenda" | "weekly" = "calendar";
</script>

<nav class="bottom-nav-mobile">
    <button
        type="button"
        id="bottom-calendar-btn"
        class="bottom-nav-item {view === 'calendar' ? 'active' : ''}"
        on:click={() => (view = "calendar")}
        aria-pressed={view === "calendar"}
        aria-current={view === "calendar" ? "page" : undefined}
        aria-label="Ir a Calendario"
    >
        <span class="nav-icon">{@html icons.calendar}</span>
        <span class="nav-text">Calendario</span>
    </button>
    <button
        type="button"
        id="bottom-agenda-btn"
        class="bottom-nav-item {view === 'agenda' ? 'active' : ''}"
        on:click={() => (view = "agenda")}
        aria-pressed={view === "agenda"}
        aria-current={view === "agenda" ? "page" : undefined}
        aria-label="Ir a Agenda"
    >
        <span class="nav-icon">{@html icons.agenda}</span>
        <span class="nav-text">Agenda</span>
    </button>
    <button
        type="button"
        id="bottom-weekly-btn"
        class="bottom-nav-item {view === 'weekly' ? 'active' : ''}"
        on:click={() => (view = "weekly")}
        aria-pressed={view === "weekly"}
        aria-current={view === "weekly" ? "page" : undefined}
        aria-label="Ir a Semanal"
    >
        <span class="nav-icon">{@html icons.weekly}</span>
        <span class="nav-text">Semanal</span>
    </button>
</nav>
