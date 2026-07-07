<script lang="ts">
  import { t } from "@/lib/i18n/index.svelte";
  import { authStore } from "@/stores/auth.svelte";
  import { filterStore } from "@/stores/filters.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import SpaceIcon from "./SpaceIcon.svelte";

  // Icon-first space picker: the collapsed pill shows only the active space's
  // icon; names/descriptions appear inside the open menu. "Add a space" is
  // inline at the bottom, mirroring the original Nodex selector. Empty
  // selection = "All spaces" (no relay filter), never "no relays".
  let root = $state<HTMLDivElement>();
  let open = $state(false);
  let showConnect = $state(false);
  let url = $state("");
  let failed = $state(false);

  const active = $derived(
    filterStore.activeRelayId
      ? timelineStore.relays.find((relay) => relay.id === filterStore.activeRelayId) ?? null
      : null
  );
  const connected = $derived(timelineStore.relays.filter((relay) => relay.connected));
  const offline = $derived(timelineStore.relays.filter((relay) => !relay.connected));

  function select(relayId: string | null) {
    filterStore.selectSpace(relayId);
    open = false;
  }

  function connect(event: SubmitEvent) {
    event.preventDefault();
    const session = authStore.addRelayUrl(url);
    if (!session) {
      failed = true;
      return;
    }
    failed = false;
    url = "";
    showConnect = false;
    timelineController.restart(session);
  }

  // why: while the menu is open, a click or Escape outside it dismisses the
  // popover (native <select> gave this for free; the custom menu must not).
  $effect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (root && !root.contains(event.target as Node)) open = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") open = false;
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  });
</script>

<div class="selector" bind:this={root}>
  <button
    class="trigger"
    class:open
    onclick={() => (open = !open)}
    data-testid="space-selector"
  >
    {#if active}
      <SpaceIcon relayId={active.id} url={active.url} connected={active.connected} size={20} />
    {:else}
      <SpaceIcon all size={20} />
    {/if}
    <svg class="chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  </button>

  {#if open}
    <div class="menu">
      <button class="row" class:active={!filterStore.activeRelayId} onclick={() => select(null)}>
        <SpaceIcon all size={20} />
        <span class="name">{t("space.all")}</span>
        {#if !filterStore.activeRelayId}
          <svg class="check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4 4 10-10" /></svg>
        {/if}
      </button>

      {#each connected as relay (relay.id)}
        <button class="row" class:active={filterStore.activeRelayId === relay.id} onclick={() => select(relay.id)}>
          <SpaceIcon relayId={relay.id} url={relay.url} connected size={20} />
          <span class="name">{relay.name}</span>
          {#if filterStore.activeRelayId === relay.id}
            <svg class="check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4 4 10-10" /></svg>
          {/if}
        </button>
      {/each}

      {#if offline.length > 0}
        <div class="divider"></div>
        {#each offline as relay (relay.id)}
          <button class="row" class:active={filterStore.activeRelayId === relay.id} onclick={() => select(relay.id)}>
            <SpaceIcon relayId={relay.id} url={relay.url} connected={false} size={20} />
            <span class="name">{relay.name}</span>
            <span class="state">{t("space.offline")}</span>
          </button>
        {/each}
      {/if}

      <div class="divider"></div>
      {#if showConnect}
        <form class="connect" onsubmit={connect}>
          <input
            type="text"
            bind:value={url}
            placeholder={t("space.addPlaceholder")}
            autocapitalize="off"
            autocorrect="off"
            class:failed
            data-testid="add-space-input"
          />
          <!-- svelte-ignore a11y_consider_explicit_label -->
          <button type="submit" class="connect-submit" disabled={!url.trim()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </form>
      {:else}
        <button class="row add" onclick={() => (showConnect = true)}>
          <span class="add-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </span>
          <span class="name">{t("space.connect")}</span>
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .selector {
    position: relative;
    min-width: 0;
    flex-shrink: 0;
  }
  .trigger {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 999px;
    padding: 0.35rem 0.55rem 0.35rem 0.6rem;
  }
  .chev {
    color: var(--text-muted);
    transition: transform 150ms ease;
  }
  .trigger.open .chev {
    transform: rotate(180deg);
  }
  .menu {
    position: absolute;
    top: calc(100% + 0.35rem);
    left: 0;
    z-index: 50;
    min-width: 12rem;
    max-width: 15rem;
    max-height: 60vh;
    overflow-y: auto;
    padding: 0.3rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 0.7rem;
    box-shadow: 0 8px 28px hsl(0 0% 0% / 0.18);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    padding: 0.45rem 0.5rem;
    border-radius: 0.5rem;
    text-align: left;
    color: var(--text);
  }
  .row:hover {
    background: var(--surface-sunken);
  }
  .row.active {
    background: var(--accent-muted);
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.9rem;
    font-weight: 500;
  }
  .check {
    color: var(--accent);
    flex-shrink: 0;
  }
  .state {
    font-size: 0.72rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .divider {
    height: 1px;
    background: var(--border);
    margin: 0.3rem 0.25rem;
  }
  .row.add {
    color: var(--text-muted);
  }
  .add-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }
  .connect {
    display: flex;
    gap: 0.35rem;
    padding: 0.15rem 0.25rem 0.25rem;
  }
  .connect input {
    flex: 1;
    min-width: 0;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--bg);
    color: var(--text);
    font-size: 0.85rem;
  }
  .connect input.failed {
    border-color: var(--danger);
  }
  .connect input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  .connect-submit {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 0.6rem;
    border-radius: 0.5rem;
    background: var(--accent);
    color: var(--accent-contrast);
    flex-shrink: 0;
  }
  .connect-submit:disabled {
    opacity: 0.5;
  }
</style>
