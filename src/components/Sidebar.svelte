<script lang="ts">
  import { deriveChannels, partitionPinnedChannels, type Topic } from "@/domain/channel";
  import { relayColorSlot } from "@/domain/relay-identity";
  import { i18n, t, type Locale } from "@/lib/i18n/index.svelte";
  import { longpress } from "@/lib/longpress";
  import { authStore } from "@/stores/auth.svelte";
  import { filterStore } from "@/stores/filters.svelte";
  import { preferencesStore } from "@/stores/preferences.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import Avatar from "./Avatar.svelte";
  import ProfileHover from "./ProfileHover.svelte";
  import AddSpace from "./AddSpace.svelte";
  import ProfileSheet from "./ProfileSheet.svelte";
  import SpaceSelector from "./SpaceSelector.svelte";
  import TopicManager from "./TopicManager.svelte";

  // Desktop-only rail (hidden < 900px, see TimelineScreen). Same stores as
  // the mobile chips row — no duplicated filter state.
  const channels = $derived(
    partitionPinnedChannels(
      deriveChannels(Object.values(timelineStore.postsById)),
      preferencesStore.pinnedChannels
    )
  );
  // In the sidebar a topic LIVES under its primary channel: pinned ones show
  // always, the rest only while that channel is included.
  function topicsFor(channelName: string): Topic[] {
    const unfolded = filterStore.channelStates[channelName] === "included";
    return timelineStore.topics.filter(
      (topic) =>
        topic.primary === channelName &&
        (preferencesStore.isTopicPinned(topic.id) || unfolded)
    );
  }

  let manager = $state<{ type: "create" } | { type: "manage"; topic: Topic } | null>(null);
  let profileOpen = $state(false);
</script>

<aside class="sidebar">
  <div class="brand">
    <svg class="glyph" viewBox="0 0 220 220">
      <g transform="translate(-54.08,-13.59) scale(1.12)" fill="none" stroke-width="31.104" stroke-linecap="round">
        <path d="M90.4329 180.698L90.0113 86.1228C89.9973 82.9897 93.8252 81.4563 95.9781 83.7326L166.928 158.748" />
        <path d="M202.53 40.0443L202.952 134.619C202.966 137.752 199.138 139.286 196.985 137.01L126.035 61.9938" />
      </g>
    </svg>
    <span>Nodex</span>
  </div>

  <SpaceSelector />
  <ul class="relays">
    {#each timelineStore.relays as relay (relay.id)}
      <li>
        <span
          class="dot"
          class:offline={!relay.connected}
          style="background: var(--relay-{relayColorSlot(relay.id)})"
        ></span>
        {relay.name}
      </li>
    {/each}
  </ul>
  <AddSpace />

  <h2>{t("sidebar.channels")}</h2>
  <nav class="channels">
    {#each [...channels.pinned, ...channels.rest] as channel (channel.name)}
      {@const pinned = preferencesStore.pinnedChannels.includes(channel.name)}
      <button
        class="channel"
        class:included={filterStore.channelStates[channel.name] === "included"}
        class:excluded={filterStore.channelStates[channel.name] === "excluded"}
        onclick={() => filterStore.tapChannelChip(channel.name)}
        use:longpress={() => preferencesStore.togglePinned(channel.name)}
      >
        <span class="name">#{channel.name}</span>
        {#if pinned}
          <svg class="pin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <path d="M12 17v5M7 4h10l-1.5 6.5 2.5 3.5H6l2.5-3.5z" />
          </svg>
        {/if}
        {#if channel.postCount > 0}<span class="count">{channel.postCount}</span>{/if}
      </button>
      {#each topicsFor(channel.name) as topic (topic.id)}
        <button
          class="channel sub"
          class:included={filterStore.selectedTopicIds.includes(topic.id)}
          onclick={() => filterStore.toggleTopic(topic)}
          use:longpress={() => (manager = { type: "manage", topic })}
        >
          <span class="name">{topic.name}</span>
          {#if preferencesStore.isTopicPinned(topic.id)}
            <svg class="pin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <path d="M12 17v5M7 4h10l-1.5 6.5 2.5 3.5H6l2.5-3.5z" />
            </svg>
          {/if}
        </button>
      {/each}
    {/each}
    <button class="channel add" onclick={() => (manager = { type: "create" })}>
      {t("sidebar.newTopic")}
    </button>
  </nav>

  <div class="user">
    <ProfileHover pubkey={authStore.session?.pubkeyHex ?? ""}>
      <Avatar
        label={authStore.session?.username ?? "?"}
        pubkey={authStore.session?.pubkeyHex ?? ""}
        picture={authStore.profilePictureUrl ?? undefined}
      />
    </ProfileHover>
    <button class="username" onclick={() => (profileOpen = true)} data-testid="edit-profile">
      {authStore.session?.username}
    </button>
    <select
      class="language"
      value={i18n.locale}
      onchange={(event) =>
        i18n.setLocale((event.currentTarget as HTMLSelectElement).value as Locale)}
    >
      <option value="en">EN</option>
      <option value="de">DE</option>
    </select>
    <button class="signout" onclick={() => authStore.signOut()}>{t("menu.signOut")}</button>
  </div>

  {#if manager}
    <TopicManager mode={manager} onClose={() => (manager = null)} />
  {/if}
  {#if profileOpen}
    <ProfileSheet onClose={() => (profileOpen = false)} />
  {/if}
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 0.9rem;
    border-right: 1px solid var(--border);
    background: var(--surface);
    height: 100dvh;
    overflow-y: auto;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-weight: 700;
    font-size: 1.05rem;
    padding-bottom: 0.25rem;
  }
  .glyph {
    width: 1.6rem;
    height: 1.6rem;
    overflow: visible;
  }
  .glyph path {
    stroke: var(--accent);
  }
  .relays {
    list-style: none;
    margin: 0;
    padding: 0 0 0 0.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .relays li {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }
  .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
  }
  .dot.offline {
    opacity: 0.35;
  }
  h2 {
    margin: 0.5rem 0 0;
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .channels {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    overflow-y: auto;
    min-height: 0;
  }
  .channels:last-of-type {
    flex: 1;
  }
  .channel.add {
    color: var(--text-muted);
    font-size: 0.85rem;
  }
  .channel.sub {
    margin-left: 1rem;
    font-size: 0.85rem;
    border-left: 2px solid var(--border);
    border-radius: 0 0.5rem 0.5rem 0;
  }
  .channel.sub.included {
    border-left-color: var(--accent-strong);
  }
  .channel {
    user-select: none;
    -webkit-user-select: none;
  }
  .channel {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.55rem;
    border-radius: 0.5rem;
    color: var(--text-muted);
    font-size: 0.9rem;
    text-align: left;
  }
  .channel:hover {
    background: var(--surface-sunken);
    color: var(--text);
  }
  .channel .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .channel.included {
    background: var(--accent);
    color: var(--accent-contrast);
  }
  .channel.excluded {
    text-decoration: line-through;
    opacity: 0.6;
  }
  .count {
    font-size: 0.75rem;
    opacity: 0.75;
  }
  .pin {
    flex-shrink: 0;
  }
  .user {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
  }
  .username {
    flex: 1;
    font-weight: 600;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }
  .username:hover {
    color: var(--accent);
  }
  .signout {
    color: var(--danger);
    font-size: 0.8rem;
  }
  .language {
    border: 1px solid var(--border);
    background: var(--bg);
    border-radius: 0.4rem;
    padding: 0.15rem 0.25rem;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
</style>
