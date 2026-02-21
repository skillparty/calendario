<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import Header from "./components/Header.svelte";
  import BottomNav from "./components/BottomNav.svelte";
  import FAB from "./components/FAB.svelte";
  import Footer from "./components/Footer.svelte";
  import PdfExportModal from "./components/PdfExportModal.svelte";
  import { fade } from "svelte/transition";
  import { API_BASE_URL, loadTasksIntoState } from "./services/api";
  import { setUserSession, userSessionStore } from "./store/state";

  import Calendar from "./views/Calendar.svelte";
  import DayModal from "./components/DayModal.svelte";
  import TaskModal from "./components/TaskModal.svelte";

  // Later we'll import full views here
  let currentView: "calendar" | "agenda" | "weekly" = "calendar";
  let agendaViewModule: Promise<any> | null = null;
  let weeklyViewModule: Promise<any> | null = null;

  const GITHUB_CLIENT_ID = "Ov23liO2tcNCvR8xrHov";
  const GITHUB_REDIRECT_URI =
    "https://calendario-frontend-ashy.vercel.app";

  function handleLogin() {
    const stateToken =
      Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("oauth_state", stateToken);
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", GITHUB_CLIENT_ID);
    authUrl.searchParams.set("scope", "user,gist");
    authUrl.searchParams.set("redirect_uri", GITHUB_REDIRECT_URI);
    authUrl.searchParams.set("state", stateToken);
    window.location.href = authUrl.toString();
  }

  async function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get("code");
    const existingSession = get(userSessionStore);

    if (authCode && !existingSession?.jwt) {
      const returnedState = params.get("state");
      const storedState = localStorage.getItem("oauth_state");

      if (storedState && returnedState && returnedState !== storedState) {
        return;
      }

      localStorage.removeItem("oauth_state");

      const response = await fetch(API_BASE_URL + "/api/auth/github", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          code: authCode,
          redirect_uri: GITHUB_REDIRECT_URI,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.success && data?.token && data?.user) {
          setUserSession({
            jwt: data.token,
            user: data.user,
            loginTime: Date.now(),
          });
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
          await loadTasksIntoState();
        }
      }
      return;
    }

    if (existingSession?.jwt) {
      await loadTasksIntoState();
    }
  }

  onMount(() => {
    const onOpenLoginModal = () => handleLogin();

    const onKeydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "n") {
        event.preventDefault();
        const today = new Date().toISOString().split("T")[0];
        window.dispatchEvent(
          new CustomEvent("openTaskModal", {
            detail: { date: today, task: null },
          }),
        );
      }
    };

    window.addEventListener("openLoginModal", onOpenLoginModal);
    window.addEventListener("keydown", onKeydown);

    handleOAuthCallback().catch(console.error);

    return () => {
      window.removeEventListener("openLoginModal", onOpenLoginModal);
      window.removeEventListener("keydown", onKeydown);
    };
  });

  function openTaskModal() {
    window.dispatchEvent(
      new CustomEvent("openDayModal", { detail: { date: new Date() } }),
    );
  }

  $: if (currentView === "agenda" && !agendaViewModule) {
    agendaViewModule = import("./views/Agenda.svelte");
  }

  $: if (currentView === "weekly" && !weeklyViewModule) {
    weeklyViewModule = import("./views/Weekly.svelte");
  }
</script>

<div class="svelte-app-root">
  <Header bind:view={currentView} />

  <main>
    {#if currentView === "calendar"}
      <div
        id="calendar-view"
        class="view"
        in:fade={{ duration: 150, delay: 150 }}
        out:fade={{ duration: 150 }}
      >
        <Calendar />
      </div>
    {:else if currentView === "agenda"}
      <div
        id="agenda-view"
        class="view"
        in:fade={{ duration: 150, delay: 150 }}
        out:fade={{ duration: 150 }}
      >
        {#if agendaViewModule}
          {#await agendaViewModule}
            <div class="view-loading">Cargando agenda…</div>
          {:then module}
            <svelte:component this={module.default} />
          {/await}
        {/if}
      </div>
    {:else if currentView === "weekly"}
      <div
        id="weekly-view"
        class="view"
        in:fade={{ duration: 150, delay: 150 }}
        out:fade={{ duration: 150 }}
      >
        {#if weeklyViewModule}
          {#await weeklyViewModule}
            <div class="view-loading">Cargando vista semanal…</div>
          {:then module}
            <svelte:component this={module.default} />
          {/await}
        {/if}
      </div>
    {/if}
  </main>

  <!-- Modals -->
  <DayModal />
  <TaskModal />
  <PdfExportModal />

  <!-- Sonner Toasts will attach to body natively -->

  <Footer />
  <BottomNav bind:view={currentView} />

  <FAB on:click={openTaskModal} />
</div>

<style>
  .svelte-app-root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    width: 100%;
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .view-loading {
    padding: 1rem;
    color: var(--text-secondary);
    font-size: 0.95rem;
  }
</style>
