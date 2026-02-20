<script lang="ts">
    import { onMount } from "svelte";
    import { userSessionStore, filtersStore } from "../store/state";
    import { handleLogout } from "../app";
    import { icons } from "./icons";

    export let view: "calendar" | "agenda" | "weekly" = "calendar";

    let showUserInfo = false;
    $: isLoggedIn =
        $userSessionStore && ($userSessionStore.jwt || $userSessionStore.token);

    function openLoginModal() {
        window.dispatchEvent(new CustomEvent("openLoginModal"));
    }
</script>

<header class="header-minimal">
    <div class="header-container">
        <div class="header-left">
            <div class="brand-section">
                <img src="public/app.png" alt="Calendar10" class="brand-logo" />
                <div class="brand-text">
                    <h1 class="brand-name">Calendar10</h1>
                    <span class="brand-tagline">development by RollanSoft.</span
                    >
                </div>
            </div>
        </div>

        <nav class="header-nav">
            <button
                class="nav-item {view === 'calendar' ? 'active' : ''}"
                on:click={() => (view = "calendar")}
            >
                <span class="nav-icon">{@html icons.calendar}</span>
                <span class="nav-text">Calendario</span>
            </button>
            <button
                class="nav-item {view === 'agenda' ? 'active' : ''}"
                on:click={() => (view = "agenda")}
            >
                <span class="nav-icon">{@html icons.agenda}</span>
                <span class="nav-text">Agenda</span>
            </button>
            <button
                class="nav-item {view === 'weekly' ? 'active' : ''}"
                on:click={() => (view = "weekly")}
            >
                <span class="nav-icon">{@html icons.weekly}</span>
                <span class="nav-text">Semanal</span>
            </button>
        </nav>

        <div class="header-right">
            <div
                id="calendar-selector"
                class="calendar-selector-container"
                style="display: none;"
            ></div>
            <button
                id="theme-toggle-btn"
                class="theme-toggle-btn"
                title="Cambiar tema"
            >
                <span id="theme-icon" class="icon"></span>
            </button>

            <div class="user-section">
                {#if isLoggedIn && $userSessionStore}
                    <div
                        class="user-info"
                        on:click={() => (showUserInfo = !showUserInfo)}
                    >
                        <img
                            src={$userSessionStore.avatarUrl ||
                                "public/avatar.png"}
                            alt="Avatar"
                            class="user-avatar"
                        />
                        <span class="user-name"
                            >{$userSessionStore.user?.user_metadata?.name ||
                                "Usuario"}</span
                        >
                        <span class="online-indicator" title="En línea">●</span>
                        {#if showUserInfo}
                            <button
                                class="logout-btn"
                                on:click|stopPropagation={handleLogout}
                                style="display: inline-block;">Salir</button
                            >
                        {/if}
                    </div>
                {:else}
                    <button class="user-btn" on:click={openLoginModal}>
                        <span class="user-icon">{@html icons.user}</span>
                        <span class="user-text">Iniciar Sesión</span>
                    </button>
                {/if}
            </div>
        </div>
    </div>
</header>
