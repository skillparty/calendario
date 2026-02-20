<script lang="ts">
    import { onMount } from "svelte";
    import { userSessionStore } from "../store/state";
    import { setTasks, setUserGistId, setUserSession } from "../store/state";
    import { icons } from "./icons";
    import { clickOutside } from "../actions/clickOutside";

    export let view: "calendar" | "agenda" | "weekly" = "calendar";

    let showUserInfo = false;
    let isDarkTheme = false;
    $: isLoggedIn =
        $userSessionStore && ($userSessionStore.jwt || $userSessionStore.token);

    function applyTheme(isDark: boolean) {
        if (typeof document !== "undefined") {
            document.documentElement.setAttribute(
                "data-theme",
                isDark ? "dark" : "light",
            );
        }
    }

    onMount(() => {
        const savedTheme = localStorage.getItem("theme");
        isDarkTheme =
            savedTheme === "dark" ||
            (!savedTheme &&
                window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);
        applyTheme(isDarkTheme);
    });

    function openLoginModal() {
        window.dispatchEvent(new CustomEvent("openLoginModal"));
    }

    function toggleUserInfo() {
        showUserInfo = !showUserInfo;
    }

    function handleUserInfoKeydown(event: KeyboardEvent) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleUserInfo();
        }

        if (event.key === "Escape") {
            showUserInfo = false;
        }
    }

    function toggleTheme() {
        isDarkTheme = !isDarkTheme;
        applyTheme(isDarkTheme);
        localStorage.setItem("theme", isDarkTheme ? "dark" : "light");
    }

    function handleLogout() {
        setUserSession(null);
        setUserGistId(null);
        setTasks({});
        showUserInfo = false;
    }
</script>

<header class="header-minimal">
    <div class="header-container">
        <div class="header-left">
            <div class="brand-section">
                <img src="/app.png" alt="Calendar10" class="brand-logo" />
                <div class="brand-text">
                    <h1 class="brand-name">Calendar10</h1>
                    <span class="brand-tagline">development by RollanSoft.</span
                    >
                </div>
            </div>
        </div>

        <nav class="header-nav">
            <button
                type="button"
                id="calendar-btn"
                class="nav-item {view === 'calendar' ? 'active' : ''}"
                on:click={() => (view = "calendar")}
                aria-pressed={view === "calendar"}
                aria-current={view === "calendar" ? "page" : undefined}
                aria-label="Ver calendario"
            >
                <span class="nav-icon">{@html icons.calendar}</span>
                <span class="nav-text">Calendario</span>
            </button>
            <button
                type="button"
                id="agenda-btn"
                class="nav-item {view === 'agenda' ? 'active' : ''}"
                on:click={() => (view = "agenda")}
                aria-pressed={view === "agenda"}
                aria-current={view === "agenda" ? "page" : undefined}
                aria-label="Ver agenda"
            >
                <span class="nav-icon">{@html icons.agenda}</span>
                <span class="nav-text">Agenda</span>
            </button>
            <button
                type="button"
                id="weekly-btn"
                class="nav-item {view === 'weekly' ? 'active' : ''}"
                on:click={() => (view = "weekly")}
                aria-pressed={view === "weekly"}
                aria-current={view === "weekly" ? "page" : undefined}
                aria-label="Ver vista semanal"
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
                type="button"
                title="Cambiar tema"
                aria-label="Cambiar tema"
                on:click={toggleTheme}
            >
                <span id="theme-icon" class="icon"
                    >{@html isDarkTheme ? icons.sun : icons.moon}</span
                >
            </button>

            <div
                class="user-section"
                use:clickOutside={() => {
                    showUserInfo = false;
                }}
            >
                {#if isLoggedIn && $userSessionStore}
                    <div
                        class="user-info"
                        role="button"
                        tabindex="0"
                        aria-expanded={showUserInfo}
                        aria-label="Abrir menú de usuario"
                        on:click={toggleUserInfo}
                        on:keydown={handleUserInfoKeydown}
                    >
                        <img
                            src={$userSessionStore.user?.avatar_url ||
                                "/app.png"}
                            alt="Avatar"
                            class="user-avatar"
                        />
                        <span class="user-name"
                            >{$userSessionStore.user?.user_metadata?.name ||
                                $userSessionStore.user?.name ||
                                "Usuario"}</span
                        >
                        <span class="online-indicator" title="En línea">●</span>
                        {#if showUserInfo}
                            <button
                                class="logout-btn"
                                type="button"
                                aria-label="Cerrar sesión"
                                on:click|stopPropagation={handleLogout}
                                style="display: inline-block;">Salir</button
                            >
                        {/if}
                    </div>
                {:else}
                    <button
                        type="button"
                        class="user-btn"
                        aria-label="Iniciar sesión"
                        on:click={openLoginModal}
                    >
                        <span class="user-icon">{@html icons.user}</span>
                        <span class="user-text">Iniciar Sesión</span>
                    </button>
                {/if}
            </div>
        </div>
    </div>
</header>
