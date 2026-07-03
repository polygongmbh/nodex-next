<script lang="ts">
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import { PublishRuleError } from "@/domain/publish-rules";

  // One bar for search and posting (the nodex mobile concept): typed text
  // live-filters the feed; typed #hashtags scope it AND become the post's
  // channels; the send button appears once the draft carries a channel.
  const canPost = $derived(timelineController.draftChannels.length > 0);
  const canSend = $derived(canPost && timelineController.draft.trim().length > 0);
  const placeholder = $derived(
    canPost
      ? `Message ${timelineController.draftChannels.map((channel) => `#${channel}`).join(" ")}`
      : "Search — add a #channel to post"
  );

  let error = $state("");
  let sending = $state(false);

  async function send() {
    if (sending || !canSend) return;
    error = "";
    sending = true;
    try {
      await timelineController.sendMessage();
    } catch (caught) {
      error =
        caught instanceof PublishRuleError ? caught.message : "Sending failed — try again.";
    } finally {
      sending = false;
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey && canSend) {
      event.preventDefault();
      void send();
    }
    if (event.key === "Escape") timelineController.draft = "";
  }
</script>

<div class="bar">
  {#if error}
    <p class="error">{error}</p>
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
    {#if canPost}
      <button class="send" onclick={send} disabled={!canSend || sending} data-testid="unified-send">
        ➤
      </button>
    {/if}
  </div>
</div>

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
