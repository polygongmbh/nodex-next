<script lang="ts">
  import type { Post } from "@/domain/post";
  import { postStatus } from "@/domain/post";
  import { personLabel, personPicture } from "@/domain/person";
  import { tokenizeContent } from "@/domain/content-tokens";
  import { formatTimelineTimestamp } from "@/domain/timeline-timestamp";
  import { i18n, t } from "@/lib/i18n/index.svelte";
  import { authStore } from "@/stores/auth.svelte";
  import { filterStore } from "@/stores/filters.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import Avatar from "./Avatar.svelte";
  import ProfileHover from "./ProfileHover.svelte";
  import SpaceIcon from "./SpaceIcon.svelte";
  import StatusIcon from "./StatusIcon.svelte";

  let {
    post,
    parent,
    replyCount,
    onRelayDots,
    onOpenMenu,
  }: {
    post: Post;
    parent?: Post;
    replyCount: number;
    onRelayDots: (relays: string[]) => void;
    onOpenMenu: (post: Post) => void;
  } = $props();

  // A tap on the card body opens the context menu — but not when the click
  // landed on an inner control (chip, crumb, link, relay dots, show-more) or
  // when the user is selecting text.
  function onCardClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a")) return;
    if (window.getSelection()?.toString()) return;
    onOpenMenu(post);
  }

  const author = $derived(timelineStore.peopleByPubkey[post.pubkey]);
  const label = $derived(personLabel(author, post.pubkey));
  const status = $derived(postStatus(post));
  const struck = $derived(status === "done" || status === "closed");
  const tokens = $derived(tokenizeContent(post.content));

  // Per-space attribution only helps when the feed mixes spaces; with one space
  // in scope every post came from it, so the icons are redundant noise.
  const showSpaces = $derived(timelineController.scopeRelayIds.length > 1);
  const spaces = $derived(
    post.relays.map((relayId) => {
      const known = timelineStore.relays.find((relay) => relay.id === relayId);
      return { id: relayId, url: known?.url ?? relayId, connected: known?.connected ?? true };
    })
  );

  const CLAMP_CHARS = 280;
  const long = $derived(post.content.length > CLAMP_CHARS || post.content.split("\n").length > 5);
  let expanded = $state(false);

  // Reaction chips: one per distinct emoji with its count, own reaction
  // highlighted. Sorted by count so the loudest reactions lead.
  const myPubkey = $derived(authStore.session?.pubkeyHex ?? null);
  const reactionChips = $derived.by(() => {
    const byEmoji = new Map<string, { count: number; mine: boolean }>();
    for (const [pubkey, reaction] of Object.entries(
      timelineStore.reactionsByTargetId[post.id] ?? {}
    )) {
      const entry = byEmoji.get(reaction.emoji) ?? { count: 0, mine: false };
      entry.count += 1;
      if (pubkey === myPubkey) entry.mine = true;
      byEmoji.set(reaction.emoji, entry);
    }
    return Array.from(byEmoji, ([emoji, value]) => ({ emoji, ...value })).sort(
      (a, b) => b.count - a.count
    );
  });

  function toggleReaction(emoji: string) {
    // The card chip has no error surface; the menu's React row does. A failed
    // publish here is swallowed rather than left as an unhandled rejection.
    void timelineController.react(post, emoji).catch(() => {});
  }

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

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article class="card" onclick={onCardClick}>
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
    <ProfileHover pubkey={post.pubkey}>
      <Avatar {label} pubkey={post.pubkey} picture={personPicture(author)} />
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
        {#if status}<span class="status-inline"><StatusIcon {status} size={16} /></span>{/if}
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
      {#if reactionChips.length > 0}
        <div class="reactions" data-testid="reactions">
          {#each reactionChips as chip (chip.emoji)}
            <button
              class="reaction"
              class:mine={chip.mine}
              onclick={() => toggleReaction(chip.emoji)}
            >
              <span class="emoji">{chip.emoji}</span>{chip.count}
            </button>
          {/each}
        </div>
      {/if}
      {#if replyCount > 0 || (showSpaces && spaces.length > 0)}
        <footer>
          {#if replyCount > 0}
            <button class="replies" onclick={() => filterStore.focusThread(post.id)}>
              ↩ {t(replyCount === 1 ? "card.reply" : "card.replies", { count: replyCount })}
            </button>
          {/if}
          <span class="spacer"></span>
          {#if showSpaces && spaces.length > 0}
            <button class="spaces" data-testid="relay-dots" onclick={() => onRelayDots(post.relays)}>
              {#each spaces as space (space.id)}
                <SpaceIcon relayId={space.id} url={space.url} connected={space.connected} size={15} />
              {/each}
            </button>
          {/if}
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
    gap: 0.6rem;
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  .status-inline {
    display: inline-block;
    width: 16px;
    height: 16px;
    vertical-align: -0.2em;
    margin-right: 0.3rem;
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
  .reactions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin: 0.1rem 0 0.4rem;
  }
  .reaction {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.1rem 0.45rem;
    border-radius: 0.7rem;
    border: 1px solid var(--border);
    background: var(--surface-sunken);
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.6;
  }
  .reaction:hover {
    border-color: var(--accent);
  }
  .reaction.mine {
    border-color: var(--accent);
    background: var(--accent-muted);
    color: var(--text);
  }
  .reaction .emoji {
    font-size: 0.95rem;
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
  .spaces {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3rem 0.25rem;
    margin: -0.3rem 0;
  }
</style>
