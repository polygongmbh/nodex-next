<script lang="ts">
  import { relayColorSlot, relayUrlToId } from "@/domain/relay-identity";
  import { resolveRelayIcon } from "@/domain/relay-icon";

  // A space's (relay's) icon: a host-derived glyph tinted with the relay's
  // stable color slot. `all` renders the neutral "All spaces" layers glyph.
  // Callers with a url should pass it so the glyph matches across the app
  // (the flattened id alone can't recover the hostname prefix).
  let {
    relayId,
    url,
    all = false,
    size = 20,
    connected = true,
  }: {
    relayId?: string;
    url?: string;
    all?: boolean;
    size?: number;
    connected?: boolean;
  } = $props();

  const seed = $derived(url ?? relayId ?? "");
  const key = $derived(all ? "all" : resolveRelayIcon(seed));
  const slot = $derived(relayId ?? (url ? relayUrlToId(url) : ""));
  const color = $derived(all ? "var(--text-muted)" : `var(--relay-${relayColorSlot(slot)})`);
</script>

<svg
  class="space-icon"
  class:offline={!connected}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  style="color: {color}"
>
  {#if key === "all"}
    <path d="M12 3l9 4.5-9 4.5-9-4.5z" />
    <path d="M3 12l9 4.5 9-4.5" />
    <path d="M3 16.5l9 4.5 9-4.5" />
  {:else if key === "play"}
    <circle cx="12" cy="12" r="9" />
    <path d="M10.5 8.5l5 3.5-5 3.5z" />
  {:else if key === "rss"}
    <circle cx="6" cy="18" r="1.2" fill="currentColor" stroke="none" />
    <path d="M5 12a7 7 0 017 7" />
    <path d="M5 6a13 13 0 0113 13" />
  {:else if key === "list"}
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 3.5h6v3H9z" />
    <path d="M9 12h6M9 16h6" />
  {:else if key === "plane"}
    <path d="M21 3L3 10.5l7 2.5 2.5 7L21 3z" />
    <path d="M21 3l-11 9.5" />
  {:else if key === "building"}
    <rect x="5" y="3" width="14" height="18" rx="1" />
    <path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4" />
  {:else if key === "tower"}
    <circle cx="12" cy="8" r="1.4" fill="currentColor" stroke="none" />
    <path d="M12 9.4V21M9 20h6" />
    <path d="M8.8 5.2a5 5 0 000 5.6M15.2 5.2a5 5 0 010 5.6" />
    <path d="M6.4 3a8.5 8.5 0 000 10M17.6 3a8.5 8.5 0 010 10" />
  {:else if key === "cpu"}
    <rect x="7" y="7" width="10" height="10" rx="1" />
    <rect x="10" y="10" width="4" height="4" />
    <path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3" />
  {:else if key === "users"}
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0111 0" />
    <path d="M16 5.2a3.2 3.2 0 010 5.6M18.5 20a5.5 5.5 0 00-3.5-5.1" />
  {:else if key === "game"}
    <rect x="3" y="8" width="18" height="9" rx="4.5" />
    <path d="M8 11.5v3M6.5 13h3" />
    <circle cx="15.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="14" r="0.9" fill="currentColor" stroke="none" />
  {:else if key === "radio"}
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    <path d="M8.5 8.5a5 5 0 000 7M15.5 8.5a5 5 0 010 7" />
    <path d="M6 6a8.5 8.5 0 000 12M18 6a8.5 8.5 0 010 12" />
  {/if}
</svg>

<style>
  .space-icon {
    display: block;
    flex-shrink: 0;
  }
  .space-icon.offline {
    opacity: 0.4;
  }
</style>
