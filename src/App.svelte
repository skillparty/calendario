<script lang="ts">
  import { onMount } from "svelte";
  import Header from "./components/Header.svelte";
  import BottomNav from "./components/BottomNav.svelte";
  import FAB from "./components/FAB.svelte";
  import { fade } from "svelte/transition";

  import Calendar from "./views/Calendar.svelte";
  import Agenda from "./views/Agenda.svelte";
  import Weekly from "./views/Weekly.svelte";
  import DayModal from "./components/DayModal.svelte";
  import TaskModal from "./components/TaskModal.svelte";

  // Later we'll import full views here
  let currentView: "calendar" | "agenda" | "weekly" = "calendar";

  onMount(() => {
    // Keep legacy app alive during migration phase
    if (typeof window !== "undefined" && "app" in window) {
      console.log(
        "Svelte Shell attached. Legacy bindings will still work for views.",
      );
    }
  });

  function openTaskModal() {
    window.dispatchEvent(
      new CustomEvent("openDayModal", { detail: { date: new Date() } }),
    );
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
        <Agenda />
      </div>
    {:else if currentView === "weekly"}
      <div
        id="weekly-view"
        class="view"
        in:fade={{ duration: 150, delay: 150 }}
        out:fade={{ duration: 150 }}
      >
        <Weekly />
      </div>
    {/if}
  </main>

  <!-- Modals -->
  <DayModal />
  <TaskModal />

  <!-- Sonner Toasts will attach to body natively -->

  <BottomNav bind:view={currentView} />

  <FAB on:click={openTaskModal} />
</div>

<style>
  .svelte-app-root {
    display: contents; /* Allows header/main/footer to slot into body grid as before */
  }
</style>
