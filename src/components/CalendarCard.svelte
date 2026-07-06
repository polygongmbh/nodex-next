<script lang="ts">
  import { type CalendarEvent, formatCalendarWhen } from "@/domain/calendar-events";
  import { personLabel } from "@/domain/person";
  import { relayColorSlot } from "@/domain/relay-identity";
  import { i18n, t } from "@/lib/i18n/index.svelte";
  import { filterStore } from "@/stores/filters.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import Avatar from "./Avatar.svelte";
  import ProfileHover from "./ProfileHover.svelte";

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
</script>

<article class="card">
  <div class="main">
    <div class="gutter">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 2.5v4M16 2.5v4" />
      </svg>
    </div>
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
      <h3 class="title">{event.title}</h3>
      <p class="when">🗓 {when}</p>
      {#if event.location}
        <p class="location">📍 {event.location}</p>
      {/if}
      {#if event.content}
        <p class="content">{event.content}</p>
      {/if}
      <footer>
        <span class="spacer"></span>
        <button class="dots" data-testid="relay-dots" onclick={() => onRelayDots(event.relays)}>
          {#each event.relays as relayId (relayId)}
            <span class="dot" style="background: var(--relay-{relayColorSlot(relayId)})"></span>
          {/each}
        </button>
      </footer>
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
    gap: 0.55rem;
  }
  .gutter {
    width: 1.4rem;
    display: flex;
    justify-content: center;
    padding-top: 0.25rem;
    flex-shrink: 0;
    color: var(--accent);
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
  .dots {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.35rem 0.25rem;
    margin: -0.35rem 0;
  }
  .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
  }
</style>
