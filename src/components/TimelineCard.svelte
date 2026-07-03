<script lang="ts">
  import type { Post } from "@/domain/post";
  import { postStatus } from "@/domain/post";
  import { personLabel } from "@/domain/person";
  import { relayColorSlot } from "@/domain/relay-identity";
  import { tokenizeContent } from "@/domain/content-tokens";
  import { formatTimelineTimestamp } from "@/domain/timeline-timestamp";
  import { timelineStore } from "@/stores/timeline.svelte";
  import Avatar from "./Avatar.svelte";
  import StatusIcon from "./StatusIcon.svelte";

  let {
    post,
    parent,
    replyCount,
    onRelayDots,
  }: {
    post: Post;
    parent?: Post;
    replyCount: number;
    onRelayDots: (postId: string) => void;
  } = $props();

  const author = $derived(timelineStore.peopleByPubkey[post.pubkey]);
  const label = $derived(personLabel(author, post.pubkey));
  const status = $derived(postStatus(post));
  const struck = $derived(status === "done" || status === "closed");
  const tokens = $derived(tokenizeContent(post.content));
  const mentionLabels = $derived(
    post.mentions.map((pubkey) => personLabel(timelineStore.peopleByPubkey[pubkey], pubkey))
  );

  const CLAMP_CHARS = 280;
  const long = $derived(post.content.length > CLAMP_CHARS || post.content.split("\n").length > 5);
  let expanded = $state(false);
</script>

<article class="card">
  {#if parent}
    <div class="parent">{parent.content.split("\n")[0]}</div>
  {/if}
  <div class="main">
    <div class="gutter">
      {#if status}
        <StatusIcon {status} size={20} />
      {/if}
    </div>
    <Avatar {label} pubkey={post.pubkey} picture={author?.picture} />
    <div class="body">
      <header>
        <span class="author">{label}</span>
        {#each mentionLabels as mention (mention)}
          <span class="chip mention">@{mention}</span>
        {/each}
        {#each post.channels as channel (channel)}
          <span class="chip channel">#{channel}</span>
        {/each}
        <time>{formatTimelineTimestamp(new Date(post.timestamp * 1000))}</time>
      </header>
      <p class="content" class:struck class:clamped={long && !expanded}>
        {#each tokens as token, index (index)}
          {#if token.type === "url"}
            <a href={token.value} target="_blank" rel="noreferrer noopener">{token.value}</a>
          {:else if token.type === "hashtag"}
            <span class="tag">#{token.value}</span>
          {:else}{token.value}{/if}
        {/each}
      </p>
      {#if long}
        <button class="more" onclick={() => (expanded = !expanded)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      {/if}
      <footer>
        {#if replyCount > 0}
          <span class="replies">↩ {replyCount}</span>
        {/if}
        <span class="spacer"></span>
        <button class="dots" data-testid="relay-dots" onclick={() => onRelayDots(post.id)}>
          {#each post.relays as relayId (relayId)}
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
  .parent {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-muted);
    padding: 0 0 0.45rem 0.4rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  .chip {
    font-size: 0.75rem;
    padding: 0.1rem 0.5rem;
    border-radius: 0.5rem;
    background: var(--surface-sunken);
  }
  .chip.mention {
    color: var(--accent);
  }
  .chip.channel {
    color: var(--accent-strong);
  }
  time {
    margin-left: auto;
    flex-shrink: 0;
    color: var(--text-muted);
    font-size: 0.75rem;
  }
  .content {
    margin: 0.2rem 0 0.35rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .content.clamped {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .content.struck {
    text-decoration: line-through;
    color: var(--text-muted);
  }
  .content a {
    color: var(--accent);
    text-decoration: none;
  }
  .content .tag {
    color: var(--accent-strong);
  }
  .more {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin-bottom: 0.3rem;
  }
  footer {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }
  .replies {
    color: var(--text-muted);
    font-size: 0.8rem;
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
