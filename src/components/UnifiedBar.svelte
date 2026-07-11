<script lang="ts">
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import { filterStore } from "@/stores/filters.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import { personLabel } from "@/domain/person";
  import { PublishRuleError } from "@/domain/publish-rules";
  import { t } from "@/lib/i18n/index.svelte";
  import ComposeEventSheet from "./ComposeEventSheet.svelte";

  // One bar for search and posting (the nodex mobile concept): typed text
  // live-filters the feed; typed #hashtags scope it AND become the post's
  // channels; the send button appears once the draft carries a channel. In a
  // focused thread the send is a reply pinned to the parent's origin relay.
  const target = $derived(timelineController.sendTarget);
  const hasCalendar = $derived(timelineController.calendarDraft !== null);
  const canPost = $derived(timelineController.draftChannels.length > 0);
  const hasBody = $derived(hasCalendar || timelineController.draft.trim().length > 0);
  const canSend = $derived(canPost && hasBody && target.type === "resolved");
  const replyParent = $derived(timelineController.replyParent);
  const replyLabel = $derived(
    replyParent
      ? personLabel(timelineStore.peopleByPubkey[replyParent.pubkey], replyParent.pubkey)
      : ""
  );
  const placeholder = $derived(
    replyParent
      ? t("bar.reply")
      : canPost
        ? t("bar.message", {
            channels: timelineController.draftChannels.map((channel) => `#${channel}`).join(" "),
          })
        : t("bar.search")
  );

  let error = $state("");
  let sending = $state(false);
  let composeEventOpen = $state(false);

  async function send() {
    if (sending || !canSend) return;
    error = "";
    sending = true;
    try {
      await timelineController.sendMessage();
    } catch (caught) {
      error = caught instanceof PublishRuleError ? t(caught.message) : t("bar.sendFailed");
    } finally {
      sending = false;
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey && canSend) {
      event.preventDefault();
      void send();
    }
    if (event.key === "Escape") {
      // Escape abandons a recompose (clears marker + prefilled draft), else
      // just clears the draft.
      if (timelineController.recomposeOf) timelineController.cancelRecompose();
      else timelineController.draft = "";
    }
  }
</script>

<div class="bar">
  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if timelineController.recomposeOf}
    <div class="reply-chip" data-testid="recompose-chip">
      <span class="reply-label">✎ {t("bar.recomposing")}</span>
      <!-- svelte-ignore a11y_consider_explicit_label -->
      <button class="remove" onclick={() => timelineController.cancelRecompose()} title={t("common.cancel")}>✕</button>
    </div>
  {:else if replyParent}
    <div class="reply-chip" data-testid="reply-chip">
      <span class="reply-label">↩ {t("bar.replyingTo", { name: replyLabel })}</span>
      <!-- svelte-ignore a11y_consider_explicit_label -->
      <button class="remove" onclick={() => filterStore.clearThread()} title={t("timeline.exitThread")}>✕</button>
    </div>
  {/if}

  {#if timelineController.calendarDraft}
    <div class="event-chip" data-testid="event-chip">
      <span class="event-title">📅 {timelineController.calendarDraft.title}</span>
      <button class="remove" onclick={() => timelineController.clearCalendarDraft()}>✕</button>
    </div>
  {/if}

  {#if target.type === "ambiguous" && hasBody}
    <div class="space-pick" data-testid="space-pick">
      <span class="prompt">{t("bar.selectSpacePrompt")}</span>
      {#each target.candidates as relay (relay.id)}
        <button class="space" onclick={() => filterStore.selectSpace(relay.id)}>{relay.name}</button>
      {/each}
    </div>
  {/if}

  <div class="row">
    <svg class="magnifier" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.8-3.8" />
    </svg>
    <textarea
      rows="1"
      {placeholder}
      bind:value={timelineController.draft}
      onkeydown={onKeydown}
      data-testid="unified-input"
    ></textarea>
    <!-- svelte-ignore a11y_consider_explicit_label -->
    <button class="attach" onclick={() => (composeEventOpen = true)} data-testid="attach-event" title={t("bar.attachEvent")}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 2.5v4M16 2.5v4" />
      </svg>
    </button>
    {#if canPost || hasCalendar}
      <button class="send" onclick={send} disabled={!canSend || sending} data-testid="unified-send">
        ➤
      </button>
    {/if}
  </div>
</div>

{#if composeEventOpen}
  <ComposeEventSheet onClose={() => (composeEventOpen = false)} />
{/if}

<style>
  .bar {
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding: 0.6rem 0.9rem calc(0.6rem + env(safe-area-inset-bottom));
  }
  .error {
    margin: 0 0 0.4rem;
    color: var(--danger);
    font-size: 0.85rem;
  }
  .event-chip {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.45rem;
    padding: 0.35rem 0.6rem;
    border-radius: 0.7rem;
    background: var(--accent-muted);
    font-size: 0.85rem;
    width: fit-content;
    max-width: 100%;
  }
  .event-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .reply-chip {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.45rem;
    padding: 0.35rem 0.6rem;
    border-radius: 0.7rem;
    background: var(--accent-muted);
    color: var(--accent);
    font-size: 0.85rem;
    font-weight: 500;
    width: fit-content;
    max-width: 100%;
  }
  .reply-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .remove {
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .remove:hover {
    color: var(--text);
  }
  .space-pick {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.45rem;
  }
  .prompt {
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .space {
    font-size: 0.8rem;
    padding: 0.25rem 0.6rem;
    border-radius: 0.7rem;
    border: 1px solid var(--accent);
    color: var(--accent);
    background: transparent;
  }
  .space:hover {
    background: var(--accent-muted);
  }
  .row {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
  }
  .magnifier {
    color: var(--text-muted);
    margin-bottom: 0.7rem;
    flex-shrink: 0;
  }
  textarea {
    flex: 1;
    resize: none;
    border: 1px solid var(--border);
    border-radius: 1.1rem;
    background: var(--bg);
    padding: 0.6rem 0.9rem;
    max-height: 7rem;
    field-sizing: content;
  }
  textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  .attach {
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 50%;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .attach:hover {
    color: var(--accent);
    background: var(--accent-muted);
  }
  .send {
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-contrast);
    font-size: 1rem;
    flex-shrink: 0;
  }
  .send:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>
