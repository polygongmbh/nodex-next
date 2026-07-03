<script lang="ts">
  import { t } from "@/lib/i18n/index.svelte";
  import { authStore } from "@/stores/auth.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";

  // Adds a relay to the session and reconnects the timeline service.
  let failed = $state(false);
  let url = $state("");

  function add(event: SubmitEvent) {
    event.preventDefault();
    const session = authStore.addRelayUrl(url);
    if (!session) {
      failed = true;
      return;
    }
    failed = false;
    url = "";
    timelineController.restart(session);
  }
</script>

<form class="add-space" onsubmit={add}>
  <input
    type="text"
    bind:value={url}
    placeholder={t("space.addPlaceholder")}
    autocapitalize="off"
    autocorrect="off"
    class:failed
    data-testid="add-space-input"
  />
  <button type="submit" disabled={!url.trim()}>{t("space.add")}</button>
</form>

<style>
  .add-space {
    display: flex;
    gap: 0.4rem;
  }
  input {
    flex: 1;
    min-width: 0;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 0.6rem;
    background: var(--bg);
    color: var(--text);
    font-size: 0.9rem;
  }
  input.failed {
    border-color: var(--danger);
  }
  input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  button {
    padding: 0.5rem 0.85rem;
    border-radius: 0.6rem;
    background: var(--accent);
    color: var(--accent-contrast);
    font-size: 0.9rem;
    font-weight: 600;
    flex-shrink: 0;
  }
  button:disabled {
    opacity: 0.5;
  }
</style>
