<script lang="ts">
  import { t } from "@/lib/i18n/index.svelte";
  import { detectMobileOS } from "@/lib/pwa";

  // Hidden when already installed (standalone display mode / legacy iOS flag)
  // or when not on a mobile OS at all.
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const os = standalone
    ? null
    : detectMobileOS(navigator.userAgent, navigator.maxTouchPoints);
</script>

{#if os}
  <div class="pwa-hint">
    <p class="lead">{t("pwa.recommend")}</p>
    <ol>
      <li>
        {#if os === "ios"}
          <svg viewBox="0 0 24 24"><path d="M8 8H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2" /><path d="M12 15V3" /><path d="M8.5 6.5 12 3l3.5 3.5" /></svg>
          <span>{t("pwa.iosShare")}</span>
        {:else}
          <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="0.5" /><circle cx="12" cy="12" r="0.5" /><circle cx="12" cy="19" r="0.5" /></svg>
          <span>{t("pwa.androidMenu")}</span>
        {/if}
      </li>
      <li>
        <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 9v6M9 12h6" /></svg>
        <span>{os === "ios" ? t("pwa.iosAdd") : t("pwa.androidAdd")}</span>
      </li>
    </ol>
  </div>
{/if}

<style>
  .pwa-hint {
    margin-top: 0.5rem;
    padding: 0.85rem 1rem;
    border: 1px solid var(--border);
    border-radius: 0.65rem;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .lead {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text);
  }
  ol {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    counter-reset: pwa-step;
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.85rem;
    color: var(--text-muted);
    counter-increment: pwa-step;
  }
  li::before {
    content: counter(pwa-step);
    flex-shrink: 0;
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-contrast);
    font-size: 0.7rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  svg {
    flex-shrink: 0;
    width: 1.3rem;
    height: 1.3rem;
    fill: none;
    stroke: var(--accent);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  circle {
    fill: var(--accent);
    stroke-width: 2.4;
  }
</style>
