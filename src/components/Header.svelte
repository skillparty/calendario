<script lang="ts">
    import { onMount } from "svelte";
    import { userSessionStore } from "../store/state";
    import { setTasks, setUserGistId, setUserSession } from "../store/state";
    import { icons } from "./icons";
    import { clickOutside } from "../actions/clickOutside";

    export let view: "calendar" | "agenda" | "weekly" = "calendar";

    let showUserInfo = false;
    let isDarkTheme = false;
    const githubIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>`;
    $: isLoggedIn =
        $userSessionStore && ($userSessionStore.jwt || $userSessionStore.token);
    $: displayUserName =
        $userSessionStore?.user?.login ||
        $userSessionStore?.user?.user_metadata?.user_name ||
        $userSessionStore?.user?.user_metadata?.preferred_username ||
        $userSessionStore?.user?.user_metadata?.name ||
        $userSessionStore?.user?.name ||
        "Usuario";

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
                            >{displayUserName}</span
                        >
                        <span class="online-indicator" title="En línea"></span>
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
                        class="user-btn login-github-btn"
                        aria-label="Iniciar sesión"
                        on:click={openLoginModal}
                    >
                        <span class="user-icon">{@html githubIcon}</span>
                        <span class="user-text">GitHub</span>
                    </button>
                {/if}
            </div>
        </div>
    </div>
</header>
