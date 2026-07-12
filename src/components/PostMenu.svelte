<script lang="ts">
  import type { Post } from "@/domain/post";
  import type { CalendarEvent } from "@/domain/calendar-events";
  import { NOSTR_KINDS } from "@/domain/nostr-kinds";
  import { buildPostPermalink } from "@/domain/permalink";
  import { QUICK_REACTION_EMOJIS } from "@/domain/reaction-events";
  import { PublishRuleError } from "@/domain/publish-rules";
  import { authStore } from "@/stores/auth.svelte";
  import { filterStore } from "@/stores/filters.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import { t } from "@/lib/i18n/index.svelte";

  // A small inline popup anchored at the tap point (WhatsApp-reactions style):
  // a quick-emoji row over a compact action row, grown out of the anchor with a
  // scale-in. No dimmed backdrop — a transparent full-viewport click-catcher
  // and Escape dismiss it. Serves both posts and calendar events.
  let {
    item,
    x,
    y,
    onClose,
  }: { item: Post | CalendarEvent; x: number; y: number; onClose: () => void } = $props();

  let copied = $state(false);
  let error = $state("");
  // Two-step destructive actions: null, or the action awaiting inline confirm.
  let confirming = $state<"delete" | "recompose" | null>(null);

  const quickEmojis = QUICK_REACTION_EMOJIS;
  // Reactions/deletions/threading key on the post id, or the calendar eventId.
  const targetId = $derived("eventId" in item ? item.eventId : item.id);
  const isOwn = $derived(item.pubkey === authStore.session?.pubkeyHex);
  // Recompose is for own messages (kind 1) and comments (kind 1111) — tasks are
  // immutable and calendar events aren't recomposable.
  const canRecompose = $derived(
    isOwn && (item.kind === NOSTR_KINDS.message || item.kind === NOSTR_KINDS.comment)
  );

  // Measured popup box, clamped to the viewport: grow down-right from the tap,
  // flip above/left when the box would overflow, and pin the transform-origin
  // to the anchored corner so the scale-in radiates from the tap.
  let width = $state(0);
  let height = $state(0);
  const MARGIN = 8;
  const placement = $derived.by(() => {
    const vw = typeof window === "undefined" ? 0 : window.innerWidth;
    const vh = typeof window === "undefined" ? 0 : window.innerHeight;
    const flipX = x + width + MARGIN > vw;
    const flipY = y + height + MARGIN > vh;
    const left = Math.max(MARGIN, Math.min(flipX ? x - width : x, vw - width - MARGIN));
    const top = Math.max(MARGIN, Math.min(flipY ? y - height : y, vh - height - MARGIN));
    return { left, top, origin: `${flipY ? "bottom" : "top"} ${flipX ? "right" : "left"}` };
  });

  function reply() {
    filterStore.focusThread(targetId);
    onClose();
  }

  function recompose() {
    if ("eventId" in item) return;
    timelineController.recompose(item);
    onClose();
  }

  async function deletePost() {
    error = "";
    try {
      await timelineController.deletePost(item);
      onClose();
    } catch (caught) {
      confirming = null;
      error = caught instanceof PublishRuleError ? t(caught.message) : t("postmenu.deleteFailed");
    }
  }

  async function react(emoji: string) {
    error = "";
    try {
      await timelineController.react(item, emoji);
      onClose();
    } catch (caught) {
      error = caught instanceof PublishRuleError ? t(caught.message) : t("postmenu.reactFailed");
    }
  }

  async function copyLink() {
    error = "";
    const url = buildPostPermalink(
      location.origin,
      targetId,
      item.relays,
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

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="catcher" onclick={onClose}></div>
<div
  class="popup"
  data-testid="post-menu"
  bind:clientWidth={width}
  bind:clientHeight={height}
  style:left="{placement.left}px"
  style:top="{placement.top}px"
  style:transform-origin={placement.origin}
>
  {#if confirming === "recompose"}
    <div class="confirm" data-testid="post-menu-recompose-confirm">
      <p class="prompt">{t("postmenu.recomposeConfirm")}</p>
      <div class="confirm-actions">
        <button class="cancel" onclick={() => (confirming = null)}>{t("common.cancel")}</button>
        <button class="proceed" onclick={recompose}>{t("postmenu.recompose")}</button>
      </div>
    </div>
  {:else if confirming === "delete"}
    <div class="confirm" data-testid="post-menu-delete-confirm">
      <p class="prompt">{t("postmenu.deleteConfirm")}</p>
      <div class="confirm-actions">
        <button class="cancel" onclick={() => (confirming = null)}>{t("common.cancel")}</button>
        <button class="danger" onclick={deletePost}>{t("postmenu.delete")}</button>
      </div>
    </div>
  {:else}
    <div class="emojis" data-testid="post-menu-react">
      {#each quickEmojis as emoji (emoji)}
        <button class="emoji" onclick={() => react(emoji)}>{emoji}</button>
      {/each}
    </div>
    <div class="actions">
      <button class="action" onclick={reply}>
        <span class="glyph">↩</span><span class="label">{t("postmenu.reply")}</span>
      </button>
      <button class="action" onclick={copyLink} data-testid="post-menu-copy">
        <span class="glyph">🔗</span>
        <span class="label">{copied ? t("postmenu.copied") : t("postmenu.copyLink")}</span>
      </button>
      {#if canRecompose}
        <button class="action" onclick={() => (confirming = "recompose")} data-testid="post-menu-recompose">
          <span class="glyph">✎</span><span class="label">{t("postmenu.recompose")}</span>
        </button>
      {/if}
      {#if isOwn}
        <button class="action destructive" onclick={() => (confirming = "delete")} data-testid="post-menu-delete">
          <span class="glyph">🗑</span><span class="label">{t("postmenu.delete")}</span>
        </button>
      {/if}
    </div>
    {#if error}
      <p class="error">{error}</p>
    {/if}
  {/if}
</div>

<style>
  /* Transparent catcher: dismiss on any outside tap, no dimming. */
  .catcher {
    position: fixed;
    inset: 0;
    z-index: 60;
  }
  .popup {
    position: fixed;
    z-index: 61;
    max-width: min(20rem, calc(100vw - 2 * 8px));
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 0.9rem;
    box-shadow: 0 6px 24px hsl(0 0% 0% / 0.28);
    padding: 0.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    animation: pop-in 150ms ease-out;
  }
  @keyframes pop-in {
    from {
      opacity: 0;
      transform: scale(0.85);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  .emojis {
    display: flex;
    flex-wrap: wrap;
    gap: 0.1rem;
    justify-content: center;
  }
  .emoji {
    font-size: 1.3rem;
    line-height: 1;
    padding: 0.3rem;
    border-radius: 0.5rem;
  }
  .emoji:hover {
    background: var(--accent-muted);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.1rem;
    border-top: 1px solid var(--border);
    padding-top: 0.25rem;
  }
  .action {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    min-width: 3.4rem;
    padding: 0.4rem 0.5rem;
    border-radius: 0.6rem;
    color: var(--text);
  }
  .action:hover {
    background: var(--accent-muted);
  }
  .action.destructive {
    color: var(--danger);
  }
  .action.destructive:hover {
    background: hsl(0 72% 48% / 0.12);
  }
  .action .glyph {
    font-size: 1.1rem;
    line-height: 1;
  }
  .action .label {
    font-size: 0.7rem;
  }
  .confirm {
    padding: 0.35rem 0.4rem 0.2rem;
    max-width: 16rem;
  }
  .confirm .prompt {
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .confirm-actions button {
    padding: 0.4rem 0.9rem;
    border-radius: 0.6rem;
    font-size: 0.9rem;
    font-weight: 500;
  }
  .confirm-actions .cancel {
    color: var(--text-muted);
  }
  .confirm-actions .proceed {
    color: var(--accent);
  }
  .confirm-actions .danger {
    background: var(--danger);
    color: #fff;
  }
  .error {
    margin: 0.1rem 0.4rem 0;
    color: var(--danger);
    font-size: 0.85rem;
  }
</style>
