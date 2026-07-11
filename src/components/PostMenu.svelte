<script lang="ts">
  import type { Post } from "@/domain/post";
  import { NOSTR_KINDS } from "@/domain/nostr-kinds";
  import { buildPostPermalink } from "@/domain/permalink";
  import { QUICK_REACTION_EMOJIS } from "@/domain/reaction-events";
  import { PublishRuleError } from "@/domain/publish-rules";
  import { authStore } from "@/stores/auth.svelte";
  import { filterStore } from "@/stores/filters.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import { t } from "@/lib/i18n/index.svelte";

  // Compact context menu for one post: a small bottom sheet on phones, a
  // centered card on desktop. Actions the caller wires up stay thin here —
  // reply focuses the thread, copy-link builds the permalink and confirms.
  let { post, onClose }: { post: Post; onClose: () => void } = $props();

  let copied = $state(false);
  let error = $state("");
  // Two-step destructive actions: null, or the action awaiting inline confirm.
  let confirming = $state<"delete" | "recompose" | null>(null);

  const quickEmojis = QUICK_REACTION_EMOJIS;
  // Own posts get recompose (kind-1 messages only — tasks are immutable) and
  // delete (any own post).
  const isOwn = $derived(post.pubkey === authStore.session?.pubkeyHex);
  const canRecompose = $derived(isOwn && post.kind === NOSTR_KINDS.message);

  function reply() {
    filterStore.focusThread(post.id);
    onClose();
  }

  function recompose() {
    timelineController.recompose(post);
    onClose();
  }

  async function deletePost() {
    error = "";
    try {
      await timelineController.deletePost(post);
      onClose();
    } catch (caught) {
      confirming = null;
      error = caught instanceof PublishRuleError ? t(caught.message) : t("postmenu.deleteFailed");
    }
  }

  async function react(emoji: string) {
    error = "";
    try {
      await timelineController.react(post, emoji);
      onClose();
    } catch (caught) {
      error = caught instanceof PublishRuleError ? t(caught.message) : t("postmenu.reactFailed");
    }
  }

  async function copyLink() {
    error = "";
    const url = buildPostPermalink(
      location.origin,
      post.id,
      post.relays,
      timelineStore.relays,
      filterStore.activeRelayId
    );
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(onClose, 900);
    } catch {
      error = t("postmenu.copyFailed");
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onClose}></div>
<div class="menu" data-testid="post-menu">
  <div class="grip"></div>
  <button class="item" onclick={reply}>
    <span class="glyph">↩</span>{t("postmenu.reply")}
  </button>
  <div class="emojis" data-testid="post-menu-react">
    {#each quickEmojis as emoji (emoji)}
      <button class="emoji" onclick={() => react(emoji)}>{emoji}</button>
    {/each}
  </div>
  <button class="item" onclick={copyLink} data-testid="post-menu-copy">
    <span class="glyph">🔗</span>{copied ? t("postmenu.copied") : t("postmenu.copyLink")}
  </button>

  {#if canRecompose}
    {#if confirming === "recompose"}
      <div class="confirm" data-testid="post-menu-recompose-confirm">
        <p class="prompt">{t("postmenu.recomposeConfirm")}</p>
        <div class="actions">
          <button class="cancel" onclick={() => (confirming = null)}>{t("common.cancel")}</button>
          <button class="proceed" onclick={recompose}>{t("postmenu.recompose")}</button>
        </div>
      </div>
    {:else}
      <button class="item" onclick={() => (confirming = "recompose")} data-testid="post-menu-recompose">
        <span class="glyph">✎</span>{t("postmenu.recompose")}
      </button>
    {/if}
  {/if}

  {#if isOwn}
    {#if confirming === "delete"}
      <div class="confirm" data-testid="post-menu-delete-confirm">
        <p class="prompt">{t("postmenu.deleteConfirm")}</p>
        <div class="actions">
          <button class="cancel" onclick={() => (confirming = null)}>{t("common.cancel")}</button>
          <button class="danger" onclick={deletePost}>{t("postmenu.delete")}</button>
        </div>
      </div>
    {:else}
      <button class="item destructive" onclick={() => (confirming = "delete")} data-testid="post-menu-delete">
        <span class="glyph">🗑</span>{t("postmenu.delete")}
      </button>
    {/if}
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: hsl(0 0% 0% / 0.4);
    z-index: 60;
  }
  .menu {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-width: 24rem;
    margin-inline: auto;
    z-index: 61;
    background: var(--surface);
    border-radius: 1rem 1rem 0 0;
    padding: 0.5rem 0.75rem calc(0.75rem + env(safe-area-inset-bottom));
    box-shadow: 0 -4px 24px hsl(0 0% 0% / 0.25);
    animation: slide-up 180ms ease-out;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  /* Desktop: a small centered card rather than a docked sheet. */
  @media (min-width: 900px) {
    .menu {
      top: 50%;
      bottom: auto;
      transform: translateY(-50%);
      border-radius: 1rem;
      padding: 0.75rem;
      animation: fade-in 140ms ease-out;
    }
  }
  @keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .grip {
    width: 2.5rem;
    height: 0.25rem;
    border-radius: 999px;
    background: var(--border);
    margin: 0.25rem auto 0.35rem;
  }
  @media (min-width: 900px) {
    .grip {
      display: none;
    }
  }
  .item {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    width: 100%;
    padding: 0.7rem 0.6rem;
    border-radius: 0.6rem;
    font-size: 0.95rem;
    text-align: left;
    color: var(--text);
  }
  .item:hover {
    background: var(--accent-muted);
  }
  .item.destructive {
    color: var(--danger);
  }
  .item.destructive:hover {
    background: hsl(0 72% 48% / 0.12);
  }
  .confirm {
    padding: 0.5rem 0.6rem 0.35rem;
  }
  .confirm .prompt {
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .confirm .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .confirm button {
    padding: 0.4rem 0.9rem;
    border-radius: 0.6rem;
    font-size: 0.9rem;
    font-weight: 500;
  }
  .confirm .cancel {
    color: var(--text-muted);
  }
  .confirm .proceed {
    color: var(--accent);
  }
  .confirm .danger {
    background: var(--danger);
    color: #fff;
  }
  .glyph {
    width: 1.25rem;
    text-align: center;
    flex-shrink: 0;
  }
  .emojis {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem;
    padding: 0.15rem 0.35rem 0.35rem;
  }
  .emoji {
    font-size: 1.35rem;
    line-height: 1;
    padding: 0.35rem;
    border-radius: 0.5rem;
  }
  .emoji:hover {
    background: var(--accent-muted);
  }
  .error {
    margin: 0.1rem 0.6rem 0;
    color: var(--danger);
    font-size: 0.85rem;
  }
</style>
