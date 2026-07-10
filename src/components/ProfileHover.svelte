<script lang="ts">
  import type { Snippet } from "svelte";
  import { nip19 } from "nostr-tools";
  import {
    personAbout,
    personLabel,
    personName,
    personNip05,
    personPicture,
    personWebsite,
  } from "@/domain/person";
  import { timelineStore } from "@/stores/timeline.svelte";
  import Avatar from "./Avatar.svelte";

  // Wraps any trigger (name, avatar, mention chip) with a profile popover.
  // Hover opens it on desktop; click toggles it for touch.
  let { pubkey, children }: { pubkey: string; children: Snippet } = $props();

  let open = $state(false);
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const person = $derived(timelineStore.peopleByPubkey[pubkey]);
  const label = $derived(personLabel(person, pubkey));
  const name = $derived(personName(person));
  const nip05 = $derived(personNip05(person));
  const about = $derived(personAbout(person));
  const website = $derived(personWebsite(person));
  const npub = $derived.by(() => {
    try {
      return nip19.npubEncode(pubkey);
    } catch {
      return pubkey;
    }
  });

  function show() {
    clearTimeout(hideTimer);
    open = true;
  }
  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => (open = false), 200);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span class="wrap" onmouseenter={show} onmouseleave={scheduleHide}>
  <button class="trigger" onclick={() => (open = !open)}>
    {@render children()}
  </button>
  {#if open}
    <div class="popover" data-testid="profile-hover">
      <div class="head">
        <Avatar {label} {pubkey} picture={personPicture(person)} />
        <div class="names">
          <span class="display">{label}</span>
          {#if name && name !== label}
            <span class="muted">@{name}</span>
          {/if}
          {#if nip05}
            <span class="muted">{nip05}</span>
          {/if}
        </div>
      </div>
      {#if about}
        <p class="about">{about}</p>
      {/if}
      {#if website}
        <a class="website" href={website} target="_blank" rel="noreferrer noopener">
          {website}
        </a>
      {/if}
      <code class="npub">{npub.slice(0, 14)}…{npub.slice(-6)}</code>
    </div>
  {/if}
</span>

<style>
  .wrap {
    position: relative;
    display: inline-flex;
    min-width: 0;
  }
  .trigger {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    text-align: left;
    color: inherit;
    font: inherit;
  }
  .popover {
    position: absolute;
    top: calc(100% + 0.35rem);
    left: 0;
    z-index: 30;
    width: 17rem;
    max-width: 80vw;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    box-shadow: 0 8px 28px hsl(0 0% 0% / 0.3);
    padding: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    cursor: default;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }
  .names {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .display {
    font-weight: 700;
  }
  .muted {
    color: var(--text-muted);
    font-size: 0.8rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .about {
    margin: 0;
    font-size: 0.85rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 6rem;
    overflow-y: auto;
  }
  .website {
    color: var(--accent);
    font-size: 0.8rem;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .npub {
    font-size: 0.7rem;
    color: var(--text-muted);
    user-select: all;
  }
</style>
