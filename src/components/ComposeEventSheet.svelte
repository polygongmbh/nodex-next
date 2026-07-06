<script lang="ts">
  import { t } from "@/lib/i18n/index.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";

  // Attaches a NIP-52 calendar event to the draft. It does NOT publish — the
  // unified bar's send resolves channels + space and posts the calendar event.
  let { onClose }: { onClose: () => void } = $props();

  const existing = timelineController.calendarDraft;
  let title = $state(existing?.title ?? "");
  let allDay = $state(existing?.allDay ?? true);
  let startDate = $state(existing?.startDate ?? new Date().toISOString().slice(0, 10));
  let startTime = $state(existing?.startTime ?? "09:00");
  let endDate = $state(existing?.endDate ?? "");
  let endTime = $state(existing?.endTime ?? "");
  let location = $state(existing?.location ?? "");

  const canAttach = $derived(title.trim().length > 0 && startDate.length > 0);

  function attach() {
    if (!canAttach) return;
    timelineController.setCalendarDraft({
      title: title.trim(),
      allDay,
      startDate,
      startTime,
      endDate: endDate || undefined,
      endTime: endTime || undefined,
      location: location.trim() || undefined,
    });
    onClose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onClose}></div>
<div class="sheet" data-testid="compose-event-sheet">
  <div class="grip"></div>
  <h2>{t("calendar.new")}</h2>

  <label>
    <span>{t("calendar.titleLabel")}</span>
    <input type="text" bind:value={title} placeholder={t("calendar.titlePlaceholder")} data-testid="event-title" />
  </label>

  <label class="row">
    <input type="checkbox" bind:checked={allDay} />
    <span>{t("calendar.allDay")}</span>
  </label>

  <div class="when">
    <label class="grow">
      <span>{t("calendar.start")}</span>
      <input type="date" bind:value={startDate} />
    </label>
    {#if !allDay}
      <label>
        <span>{t("calendar.startTime")}</span>
        <input type="time" bind:value={startTime} />
      </label>
    {/if}
  </div>

  <div class="when">
    <label class="grow">
      <span>{t("calendar.end")} {t("common.optional")}</span>
      <input type="date" bind:value={endDate} />
    </label>
    {#if !allDay}
      <label>
        <span>{t("calendar.startTime")}</span>
        <input type="time" bind:value={endTime} />
      </label>
    {/if}
  </div>

  <label>
    <span>{t("calendar.location")} {t("common.optional")}</span>
    <input type="text" bind:value={location} placeholder={t("calendar.locationPlaceholder")} />
  </label>

  <button class="primary" onclick={attach} disabled={!canAttach} data-testid="event-attach">
    {t("calendar.attach")}
  </button>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: hsl(0 0% 0% / 0.4);
    z-index: 50;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-width: 32rem;
    margin-inline: auto;
    z-index: 51;
    background: var(--surface);
    border-radius: 1rem 1rem 0 0;
    padding: 0.5rem 1.25rem calc(1rem + env(safe-area-inset-bottom));
    box-shadow: 0 -4px 24px hsl(0 0% 0% / 0.25);
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    max-height: 88dvh;
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
  label.row {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    color: var(--text);
    font-size: 0.9rem;
  }
  label.row input {
    width: auto;
  }
  .when {
    display: flex;
    gap: 0.65rem;
    align-items: flex-end;
  }
  .grow {
    flex: 1;
  }
  input {
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.6rem;
    background: var(--bg);
    color: var(--text);
    font-size: 0.95rem;
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
    opacity: 0.6;
  }
</style>
