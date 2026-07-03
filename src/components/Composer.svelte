<script lang="ts">
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import { PublishRuleError } from "@/domain/publish-rules";

  // Visible when a channel is included OR the draft already carries a
  // #hashtag (so deselecting a chip mid-draft doesn't hide your text).
  const visible = $derived(timelineController.draftChannels.length > 0);
  const canSend = $derived(visible && timelineController.draft.trim().length > 0);

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
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }
</script>

{#if visible}
  <div class="composer">
    {#if error}
      <p class="error">{error}</p>
    {/if}
    <div class="row">
      <textarea
        rows="1"
        placeholder="Message {timelineController.draftChannels.map((c) => `#${c}`).join(' ')}"
        bind:value={timelineController.draft}
        onkeydown={onKeydown}
        data-testid="composer-input"
      ></textarea>
      <button class="send" onclick={send} disabled={!canSend || sending} data-testid="composer-send">
        ➤
      </button>
    </div>
  </div>
{:else}
  <div class="composer hint-bar">Pick a #channel to post</div>
{/if}

<style>
  .composer {
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding: 0.6rem 0.9rem calc(0.6rem + env(safe-area-inset-bottom));
  }
  .hint-bar {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.85rem;
    padding-top: 0.8rem;
    padding-bottom: calc(0.8rem + env(safe-area-inset-bottom));
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
