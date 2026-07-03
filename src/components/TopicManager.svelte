<script lang="ts">
  import { deriveChannels, topicTags, type Topic } from "@/domain/channel";
  import { t } from "@/lib/i18n/index.svelte";
  import { filterStore } from "@/stores/filters.svelte";
  import { preferencesStore } from "@/stores/preferences.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";

  // Bottom sheet for topic management: create a topic (primary channel +
  // secondary channels, no prior selection required), or manage an existing
  // one (pin / delete) after long-press.
  let {
    mode,
    onClose,
  }: {
    mode: { type: "create" } | { type: "manage"; topic: Topic };
    onClose: () => void;
  } = $props();

  const knownChannels = $derived(
    deriveChannels(Object.values(timelineStore.postsById)).map((channel) => channel.name)
  );

  let name = $state("");
  let primary = $state(filterStore.includedChannels[0] ?? "");
  let secondary = $state<string[]>(filterStore.includedChannels.slice(1));
  let customTag = $state("");

  const primaryOptions = $derived(
    Array.from(new Set([primary, ...knownChannels, ...secondary].filter(Boolean)))
  );

  function toggleSecondary(tag: string) {
    secondary = secondary.includes(tag)
      ? secondary.filter((candidate) => candidate !== tag)
      : [...secondary, tag];
  }

  function addCustomTag() {
    const tag = customTag.trim().replace(/^#/, "").toLowerCase();
    customTag = "";
    if (!tag) return;
    if (!primary) primary = tag;
    else if (tag !== primary && !secondary.includes(tag)) secondary = [...secondary, tag];
  }

  function create() {
    if (!name.trim() || !primary) return;
    const topic = preferencesStore.createTopic(name, primary, secondary);
    preferencesStore.toggleTopicPinned(topic.id);
    onClose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onClose}></div>
<div class="sheet" data-testid="topic-manager">
  <div class="grip"></div>
  {#if mode.type === "create"}
    <h2>{t("topics.new")}</h2>
    <input
      type="text"
      bind:value={name}
      placeholder={t("topics.namePlaceholder")}
      data-testid="topic-name"
    />
    <label>
      <span>{t("topics.primary")}</span>
      <select bind:value={primary} data-testid="topic-primary">
        {#if !primary}<option value="" disabled selected></option>{/if}
        {#each primaryOptions as channel (channel)}
          <option value={channel}>#{channel}</option>
        {/each}
      </select>
    </label>
    <span class="group-label">{t("topics.secondary")}</span>
    <div class="tags">
      {#each Array.from(new Set([...knownChannels, ...secondary])).filter((tag) => tag !== primary) as tag (tag)}
        <button class="tag" class:on={secondary.includes(tag)} onclick={() => toggleSecondary(tag)}>
          #{tag}
        </button>
      {/each}
    </div>
    <input
      type="text"
      bind:value={customTag}
      placeholder={t("topics.addTag")}
      onkeydown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addCustomTag();
        }
      }}
      onblur={addCustomTag}
    />
    <button class="primary-btn" onclick={create} disabled={!name.trim() || !primary}>
      {t("topics.create")}
    </button>
  {:else}
    <h2>{mode.topic.name}</h2>
    <div class="tags">
      {#each topicTags(mode.topic) as tag, index (tag)}
        <span class="tag static" class:main={index === 0}>#{tag}</span>
      {/each}
    </div>
    <button
      class="action"
      onclick={() => {
        preferencesStore.toggleTopicPinned(mode.type === "manage" ? mode.topic.id : "");
        onClose();
      }}
    >
      {t(mode.topic.pinned ? "topics.unpin" : "topics.pin")}
    </button>
    <button
      class="action danger"
      onclick={() => {
        preferencesStore.deleteTopic(mode.type === "manage" ? mode.topic.id : "");
        onClose();
      }}
    >
      {t("topics.delete")}
    </button>
  {/if}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: hsl(0 0% 0% / 0.4);
    z-index: 40;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-width: 32rem;
    margin-inline: auto;
    z-index: 41;
    background: var(--surface);
    border-radius: 1rem 1rem 0 0;
    padding: 0.5rem 1.25rem calc(1rem + env(safe-area-inset-bottom));
    box-shadow: 0 -4px 24px hsl(0 0% 0% / 0.25);
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    max-height: 85dvh;
    overflow-y: auto;
  }
  .grip {
    width: 2.5rem;
    height: 0.25rem;
    border-radius: 999px;
    background: var(--border);
    margin: 0.25rem auto 0;
  }
  h2 {
    margin: 0;
    font-size: 1rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .group-label {
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    max-height: 30dvh;
    overflow-y: auto;
  }
  .tag {
    font-size: 0.85rem;
    color: var(--text-muted);
    background: var(--surface-sunken);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 0.2rem 0.55rem;
  }
  .tag.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-contrast);
  }
  .tag.static {
    color: var(--accent-strong);
    border: none;
  }
  .tag.static.main {
    font-weight: 700;
  }
  input,
  select {
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: 0.65rem;
    background: var(--bg);
    color: var(--text);
    font-size: 0.95rem;
  }
  input:focus,
  select:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  .primary-btn {
    padding: 0.7rem;
    border-radius: 0.65rem;
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 600;
  }
  .primary-btn:disabled {
    opacity: 0.5;
  }
  .action {
    padding: 0.6rem;
    border-radius: 0.65rem;
    border: 1px solid var(--border);
    font-weight: 500;
  }
  .action.danger {
    color: var(--danger);
    border-color: var(--danger);
  }
</style>
