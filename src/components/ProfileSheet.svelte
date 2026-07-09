<script lang="ts">
  import { defaultDisplayName, parseProfileFields } from "@/domain/person";
  import { t } from "@/lib/i18n/index.svelte";
  import { authStore } from "@/stores/auth.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import AvatarUpload from "./AvatarUpload.svelte";

  // Profile editor, reachable any time after onboarding. Scope "All spaces"
  // publishes one kind-0 everywhere; picking a space fetches and publishes a
  // separate kind-0 living only on that relay (per-space profiles).
  let { onClose }: { onClose: () => void } = $props();

  let scope = $state<string>("*");
  let displayName = $state("");
  let about = $state("");
  let picture = $state("");
  let website = $state("");
  let loading = $state(true);
  let saving = $state(false);
  let feedback = $state<"" | "saved" | "error">("");

  // why: switching the scope selector must re-prefill from that scope's
  // kind-0 (a space may carry its own profile distinct from the global one).
  $effect(() => {
    const currentScope = scope;
    loading = true;
    feedback = "";
    void timelineController
      .fetchOwnProfile(currentScope === "*" ? undefined : currentScope)
      .then((existing) => {
        if (scope !== currentScope) return;
        const parsed = parseProfileFields(existing);
        displayName =
          parsed.displayName ||
          parsed.name ||
          defaultDisplayName(authStore.session?.username ?? "");
        about = parsed.about;
        website = parsed.website;
        picture = parsed.picture || authStore.profilePictureUrl || "";
      })
      .finally(() => {
        if (scope === currentScope) loading = false;
      });
  });

  async function save() {
    if (saving) return;
    saving = true;
    feedback = "";
    try {
      await timelineController.publishProfile(
        {
          name: authStore.session?.username,
          displayName: displayName.trim() || defaultDisplayName(authStore.session?.username ?? ""),
          about,
          picture: picture.trim(),
          website,
        },
        scope === "*" ? undefined : scope
      );
      feedback = "saved";
    } catch {
      feedback = "error";
    } finally {
      saving = false;
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onClose}></div>
<div class="sheet" data-testid="profile-sheet">
  <div class="grip"></div>
  <h2>{t("profile.edit")}</h2>

  <label>
    <span>{t("profile.scope")}</span>
    <select bind:value={scope}>
      <option value="*">{t("space.all")}</option>
      {#each timelineStore.relays as relay (relay.id)}
        <option value={relay.id}>{relay.name}</option>
      {/each}
    </select>
  </label>

  {#if loading}
    <p class="hint">{t("profile.fetching")}</p>
  {:else}
    <AvatarUpload
      bind:picture
      pubkey={authStore.session?.pubkeyHex ?? ""}
      label={displayName}
    />
    <label>
      <span>{t("profile.displayName")}</span>
      <input type="text" bind:value={displayName} />
    </label>
    <label>
      <span>{t("profile.bio")}</span>
      <textarea rows="2" bind:value={about}></textarea>
    </label>
    <label>
      <span>{t("profile.website")}</span>
      <input type="url" bind:value={website} placeholder="https://…" />
    </label>
    {#if feedback === "saved"}
      <p class="ok">{t("profile.saved")}</p>
    {:else if feedback === "error"}
      <p class="error">{t("profile.saveError")}</p>
    {/if}
    <button class="primary" onclick={save} disabled={saving}>
      {saving ? t("common.saving") : scope === "*" ? t("profile.saveAll") : t("profile.saveSpace")}
    </button>
  {/if}
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
  .hint {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  input,
  textarea,
  select {
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.6rem;
    background: var(--bg);
    color: var(--text);
    font-size: 0.95rem;
    resize: none;
  }
  input:focus,
  textarea:focus,
  select:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  .ok {
    margin: 0;
    color: var(--relay-1);
    font-size: 0.85rem;
  }
  .error {
    margin: 0;
    color: var(--danger);
    font-size: 0.85rem;
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
