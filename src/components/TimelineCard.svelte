<script lang="ts">
  import type { Post } from "@/domain/post";
  import { postStatus } from "@/domain/post";
  import { personLabel } from "@/domain/person";
  import { relayColorSlot } from "@/domain/relay-identity";
  import { tokenizeContent } from "@/domain/content-tokens";
  import { formatTimelineTimestamp } from "@/domain/timeline-timestamp";
  import { i18n, t } from "@/lib/i18n/index.svelte";
  import { filterStore } from "@/stores/filters.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import Avatar from "./Avatar.svelte";
  import ProfileHover from "./ProfileHover.svelte";
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

  const CLAMP_CHARS = 280;
  const long = $derived(post.content.length > CLAMP_CHARS || post.content.split("\n").length > 5);
  let expanded = $state(false);

  // Ancestor chain for the breadcrumb header, oldest first (root › … › parent).
  const crumbs = $derived.by(() => {
    const chain: Post[] = [];
    let current = parent;
    while (current && chain.length < 3) {
      chain.unshift(current);
      current = current.parentId ? timelineStore.postsById[current.parentId] : undefined;
    }
    return chain;
  });
</script>

<article class="card">
  {#if crumbs.length > 0}
    <nav class="crumbs">
      {#each crumbs as crumb, index (crumb.id)}
        {#if index > 0}<span class="crumb-sep">›</span>{/if}
        <button class="crumb" onclick={() => filterStore.focusThread(crumb.id)}>
          {crumb.content.split("\n")[0]}
        </button>
      {/each}
    </nav>
  {/if}
  <div class="main">
    <div class="gutter">
      {#if status}
        <StatusIcon {status} size={20} />
      {/if}
    </div>
    <ProfileHover pubkey={post.pubkey}>
      <Avatar {label} pubkey={post.pubkey} picture={author?.picture} />
    </ProfileHover>
    <div class="body">
      <header>
        <ProfileHover pubkey={post.pubkey}>
          <span class="author">{label}</span>
        </ProfileHover>
        {#each post.mentions as mention (mention)}
          <ProfileHover pubkey={mention}>
            <span class="chip mention">
              @{personLabel(timelineStore.peopleByPubkey[mention], mention)}
            </span>
          </ProfileHover>
        {/each}
        {#each post.channels as channel (channel)}
          <button class="chip channel" onclick={() => filterStore.tapChannelChip(channel)}>
            #{channel}
          </button>
        {/each}
        <time>{formatTimelineTimestamp(new Date(post.timestamp * 1000), i18n.locale)}</time>
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
          {expanded ? t("card.showLess") : t("card.showMore")}
        </button>
      {/if}
      <footer>
        {#if replyCount > 0}
          <button class="replies" onclick={() => filterStore.focusThread(post.id)}>
            ↩ {t(replyCount === 1 ? "card.reply" : "card.replies", { count: replyCount })}
          </button>
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
  .crumbs {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0 0 0.45rem 0.4rem;
    min-width: 0;
  }
  .crumb {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 14rem;
  }
  .crumb:hover {
    color: var(--accent);
  }
  .crumb-sep {
    color: var(--text-muted);
    flex-shrink: 0;
    font-size: 0.9rem;
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
  .author:hover,
  .chip.channel:hover {
    color: var(--accent);
    cursor: pointer;
  }
  .chip {
    font-size: 0.75rem;
    padding: 0.1rem 0.5rem;
    border-radius: 0.5rem;
    background: var(--accent-muted);
    color: var(--text);
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
  .replies:hover {
    color: var(--accent);
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
