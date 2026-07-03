<script lang="ts">
  import type { TimelineEntry } from "@/stores/timeline.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import { personLabel } from "@/domain/person";
  import { postStatus } from "@/domain/post";
  import { relayColorSlot } from "@/domain/relay-identity";
  import { formatTimelineTimestamp } from "@/domain/timeline-timestamp";
  import Avatar from "./Avatar.svelte";

  let {
    entry,
    onRelayDots,
  }: { entry: TimelineEntry; onRelayDots: (postId: string) => void } = $props();

  const post = $derived(entry.post);
  const author = $derived(timelineStore.peopleByPubkey[post.pubkey]);
  const label = $derived(personLabel(author, post.pubkey));
  const status = $derived(postStatus(post));

  const STATUS_ICONS: Record<string, string> = {
    open: "○",
    active: "◐",
    done: "●",
    closed: "⊘",
  };
</script>

<article class="card">
  <Avatar {label} pubkey={post.pubkey} picture={author?.picture} />
  <div class="body">
    <header>
      <span class="author">{label}</span>
      {#if status}
        <span class="status status-{status}" title={status}>{STATUS_ICONS[status]}</span>
      {/if}
      <time>{formatTimelineTimestamp(new Date(post.timestamp * 1000))}</time>
    </header>
    <p class="content">{post.content}</p>
    <footer>
      {#each post.channels as channel (channel)}
        <span class="channel">#{channel}</span>
      {/each}
      <span class="spacer"></span>
      {#if entry.replyCount > 0}
        <span class="replies">↩ {entry.replyCount}</span>
      {/if}
      <button class="dots" data-testid="relay-dots" onclick={() => onRelayDots(post.id)}>
        {#each post.relays as relayId (relayId)}
          <span class="dot" style="background: var(--relay-{relayColorSlot(relayId)})"></span>
        {/each}
      </button>
    </footer>
  </div>
</article>

<style>
  .card {
    display: flex;
    gap: 0.65rem;
    padding: 0.75rem 1rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  header {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  .author {
    font-weight: 600;
    font-size: 0.95rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .status {
    font-size: 0.85rem;
  }
  .status-done { color: var(--relay-1); }
  .status-active { color: var(--accent); }
  .status-closed { color: var(--text-muted); }
  .status-open { color: var(--text-muted); }
  time {
    margin-left: auto;
    flex-shrink: 0;
    color: var(--text-muted);
    font-size: 0.75rem;
  }
  .content {
    margin: 0.15rem 0 0.35rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  footer {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }
  .channel {
    color: var(--accent);
    font-size: 0.8rem;
  }
  .spacer {
    flex: 1;
  }
  .replies {
    color: var(--text-muted);
    font-size: 0.8rem;
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
