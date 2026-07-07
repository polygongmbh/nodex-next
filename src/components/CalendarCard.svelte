<script lang="ts">
  import { type CalendarEvent, formatCalendarWhen } from "@/domain/calendar-events";
  import { personLabel } from "@/domain/person";
  import { i18n, t } from "@/lib/i18n/index.svelte";
  import { filterStore } from "@/stores/filters.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import Avatar from "./Avatar.svelte";
  import ProfileHover from "./ProfileHover.svelte";
  import SpaceIcon from "./SpaceIcon.svelte";

  let {
    event,
    onRelayDots,
  }: {
    event: CalendarEvent;
    onRelayDots: (relays: string[]) => void;
  } = $props();

  const author = $derived(timelineStore.peopleByPubkey[event.pubkey]);
  const label = $derived(personLabel(author, event.pubkey));
  const when = $derived(formatCalendarWhen(event, i18n.locale));

  // Attribution icons only add signal when the feed spans multiple spaces.
  const showSpaces = $derived(timelineController.scopeRelayIds.length > 1);
  const spaces = $derived(
    event.relays.map((relayId) => {
      const known = timelineStore.relays.find((relay) => relay.id === relayId);
      return { id: relayId, url: known?.url ?? relayId, connected: known?.connected ?? true };
    })
  );
</script>

<article class="card">
  <div class="main">
    <ProfileHover pubkey={event.pubkey}>
      <Avatar {label} pubkey={event.pubkey} picture={author?.picture} />
    </ProfileHover>
    <div class="body">
      <header>
        <ProfileHover pubkey={event.pubkey}>
          <span class="author">{label}</span>
        </ProfileHover>
        <span class="kicker">{t("calendar.attached")}</span>
        {#each event.channels as channel (channel)}
          <button class="chip channel" onclick={() => filterStore.tapChannelChip(channel)}>
            #{channel}
          </button>
        {/each}
      </header>
      <h3 class="title">
        <svg class="title-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4.5" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 2.5v4M16 2.5v4" />
        </svg>{event.title}</h3>
      <p class="when">🗓 {when}</p>
      {#if event.location}
        <p class="location">📍 {event.location}</p>
      {/if}
      {#if event.content}
        <p class="content">{event.content}</p>
      {/if}
      {#if showSpaces && spaces.length > 0}
        <footer>
          <span class="spacer"></span>
          <button class="spaces" data-testid="relay-dots" onclick={() => onRelayDots(event.relays)}>
            {#each spaces as space (space.id)}
              <SpaceIcon relayId={space.id} url={space.url} connected={space.connected} size={15} />
            {/each}
          </button>
        </footer>
      {/if}
    </div>
  </div>
</article>

<style>
  .card {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 0.6rem 1rem 0.5rem 0.6rem;
  }
  .main {
    display: flex;
    gap: 0.6rem;
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .author {
    font-weight: 600;
    font-size: 0.95rem;
  }
  .author:hover,
  .chip.channel:hover {
    color: var(--accent);
    cursor: pointer;
  }
  .kicker {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }
  .chip {
    font-size: 0.75rem;
    padding: 0.1rem 0.5rem;
    border-radius: 0.5rem;
    background: var(--accent-muted);
    color: var(--text);
  }
  .title {
    margin: 0.3rem 0 0.1rem;
    font-size: 1rem;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .title-icon {
    display: inline-block;
    vertical-align: -0.15em;
    margin-right: 0.35rem;
    color: var(--accent);
  }
  .when,
  .location {
    margin: 0.1rem 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .content {
    margin: 0.35rem 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  footer {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }
  .spacer {
    flex: 1;
  }
  .spaces {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3rem 0.25rem;
    margin: -0.3rem 0;
  }
</style>
