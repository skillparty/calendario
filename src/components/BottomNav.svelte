<script lang="ts">
    import { icons } from "./icons";
    export let view: "calendar" | "agenda" | "weekly" = "calendar";
</script>

<nav class="bottom-nav-mobile">
    <button
        class="bottom-nav-item {view === 'calendar' ? 'active' : ''}"
        on:click={() => (view = "calendar")}
    >
        <span class="nav-icon">{@html icons.calendar}</span>
        <span class="nav-text">Calendario</span>
    </button>
    <button
        class="bottom-nav-item {view === 'agenda' ? 'active' : ''}"
        on:click={() => (view = "agenda")}
    >
        <span class="nav-icon">{@html icons.agenda}</span>
        <span class="nav-text">Agenda</span>
    </button>
    <button
        class="bottom-nav-item {view === 'weekly' ? 'active' : ''}"
        on:click={() => (view = "weekly")}
    >
        <span class="nav-icon">{@html icons.weekly}</span>
        <span class="nav-text">Semanal</span>
    </button>
</nav>
