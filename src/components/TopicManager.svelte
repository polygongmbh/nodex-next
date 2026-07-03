<script lang="ts">
  import type { Topic } from "@/domain/channel";
  import { preferencesStore } from "@/stores/preferences.svelte";

  // Bottom sheet for topic management: create a topic from the current
  // context tags, or manage an existing one (pin / delete) after long-press.
  let {
    mode,
    contextTags,
    onClose,
  }: {
    mode: { type: "create" } | { type: "manage"; topic: Topic };
    contextTags: string[];
    onClose: () => void;
  } = $props();

  let name = $state("");

  function create() {
    if (!name.trim() || contextTags.length === 0) return;
    const topic = preferencesStore.createTopic(name, contextTags);
    preferencesStore.toggleTopicPinned(topic.id);
    onClose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onClose}></div>
<div class="sheet" data-testid="topic-manager">
  <div class="grip"></div>
  {#if mode.type === "create"}
    <h2>New topic</h2>
    {#if contextTags.length === 0}
      <p class="hint">Select channels or type #hashtags first — a topic is made of tags.</p>
    {:else}
      <div class="tags">
        {#each contextTags as tag (tag)}
          <span class="tag">#{tag}</span>
        {/each}
      </div>
      <input
        type="text"
        bind:value={name}
        placeholder="Topic name, e.g. CalDav Integration"
        data-testid="topic-name"
      />
      <button class="primary" onclick={create} disabled={!name.trim()}>Create topic</button>
    {/if}
  {:else}
    <h2>{mode.topic.name}</h2>
    <div class="tags">
      {#each mode.topic.tags as tag (tag)}
        <span class="tag">#{tag}</span>
      {/each}
    </div>
    <button
      class="action"
      onclick={() => {
        preferencesStore.toggleTopicPinned(mode.type === "manage" ? mode.topic.id : "");
        onClose();
      }}
    >
      {mode.topic.pinned ? "Unpin" : "Pin"}
    </button>
    <button
      class="action danger"
      onclick={() => {
        preferencesStore.deleteTopic(mode.type === "manage" ? mode.topic.id : "");
        onClose();
      }}
    >
      Delete topic
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
  .hint {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9rem;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .tag {
    font-size: 0.85rem;
    color: var(--accent-strong);
    background: var(--surface-sunken);
    border-radius: 0.5rem;
    padding: 0.15rem 0.5rem;
  }
  input {
    padding: 0.65rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: 0.65rem;
    background: var(--bg);
    color: var(--text);
  }
  input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  .primary {
    padding: 0.7rem;
    border-radius: 0.65rem;
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 600;
  }
  .primary:disabled {
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
