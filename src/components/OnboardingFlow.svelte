<script lang="ts">
  import { deriveChannels } from "@/domain/channel";
  import { t } from "@/lib/i18n/index.svelte";
  import { authStore } from "@/stores/auth.svelte";
  import { preferencesStore } from "@/stores/preferences.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import AddSpace from "./AddSpace.svelte";
  import Avatar from "./Avatar.svelte";

  import { onMount } from "svelte";

  // (Space →) welcome → profile → channels. The space step only appears when
  // the account has no space configured; the timeline service already runs
  // behind this flow, so the channel step offers live channels.
  let step = $state<"space" | "welcome" | "profile" | "channels">(
    (authStore.session?.relayUrls.length ?? 0) > 0 ? "welcome" : "space"
  );

  // why: adding the first space (via AddSpace) updates the session — advance
  // out of the space step as soon as one exists.
  $effect(() => {
    if (step === "space" && (authStore.session?.relayUrls.length ?? 0) > 0) {
      step = "welcome";
    }
  });

  let displayName = $state(authStore.session?.username ?? "");
  let about = $state("");
  let picture = $state("");
  let website = $state("");
  let profileLoading = $state(true);
  let profileError = $state("");
  let saving = $state(false);

  // why: an existing kind-0 on the relays must prefill (and survive) the
  // profile step, so republishing never wipes a profile made elsewhere.
  onMount(() => {
    void timelineController
      .fetchOwnProfile()
      .then((existing) => {
        const text = (value: unknown): string =>
          typeof value === "string" ? value.trim() : "";
        displayName =
          text(existing.display_name) || text(existing.name) || displayName;
        about = text(existing.about) || about;
        website = text(existing.website) || website;
        picture = text(existing.picture) || authStore.profilePictureUrl || "";
      })
      .finally(() => (profileLoading = false));
  });

  let selected = $state<string[]>([]);
  const channels = $derived(deriveChannels(Object.values(timelineStore.postsById)));

  async function saveProfile() {
    if (saving) return;
    profileError = "";
    saving = true;
    try {
      await timelineController.publishProfile({
        name: authStore.session?.username,
        displayName: displayName.trim() || (authStore.session?.username ?? ""),
        about,
        picture: picture.trim(),
        website,
      });
      step = "channels";
    } catch {
      profileError = t("onboarding.profileError");
    } finally {
      saving = false;
    }
  }

  function toggle(name: string) {
    selected = selected.includes(name)
      ? selected.filter((channel) => channel !== name)
      : [...selected, name];
  }

  function finish() {
    preferencesStore.completeOnboarding(selected);
  }
</script>

<div class="screen">
  {#if step === "space"}
    <div class="step">
      <h1>{t("onboarding.spaceTitle")}</h1>
      <p class="hint">{t("onboarding.spaceHint")}</p>
      <AddSpace />
    </div>
  {:else if step === "welcome"}
    <div class="step center">
      <svg class="glyph" viewBox="0 0 220 220">
        <g transform="translate(-54.08,-13.59) scale(1.12)" fill="none" stroke-width="31.104" stroke-linecap="round">
          <path d="M90.4329 180.698L90.0113 86.1228C89.9973 82.9897 93.8252 81.4563 95.9781 83.7326L166.928 158.748" />
          <path d="M202.53 40.0443L202.952 134.619C202.966 137.752 199.138 139.286 196.985 137.01L126.035 61.9938" />
        </g>
      </svg>
      <h1>{t("onboarding.welcome", { name: authStore.session?.username ?? "" })}</h1>
      <p>{t("onboarding.personalize")}</p>
      <button class="primary" onclick={() => (step = "profile")}>{t("onboarding.go")}</button>
    </div>
  {:else if step === "profile"}
    <div class="step">
      <h1>{t("onboarding.profileTitle")}</h1>
      {#if profileLoading}
        <p class="hint">{t("onboarding.fetching")}</p>
      {:else}
        <div class="avatar-row">
          <Avatar
            label={displayName || "?"}
            pubkey={authStore.session?.pubkeyHex ?? ""}
            picture={picture || undefined}
          />
          <label class="grow">
            <span>{t("profile.picture")} <em>{t("common.optional")}</em></span>
            <input type="url" bind:value={picture} placeholder="https://…" />
          </label>
        </div>
        <label>
          <span>{t("profile.displayName")}</span>
          <input type="text" bind:value={displayName} data-testid="onboarding-display-name" />
        </label>
        <label>
          <span>{t("profile.bio")} <em>{t("common.optional")}</em></span>
          <textarea rows="3" bind:value={about} placeholder={t("profile.bioPlaceholder")}></textarea>
        </label>
        <label>
          <span>{t("profile.website")} <em>{t("common.optional")}</em></span>
          <input type="url" bind:value={website} placeholder="https://…" />
        </label>
        {#if profileError}
          <p class="error">{profileError}</p>
        {/if}
        <button class="primary" onclick={saveProfile} disabled={saving}>
          {saving ? t("common.saving") : t("onboarding.continue")}
        </button>
        <button class="skip" onclick={() => (step = "channels")}>{t("onboarding.skip")}</button>
      {/if}
    </div>
  {:else}
    <div class="step">
      <h1>{t("onboarding.channelsTitle")}</h1>
      <p class="hint">{t("onboarding.channelsHint")}</p>
      {#if channels.length === 0}
        <p class="hint">
          {timelineStore.hydrating ? t("onboarding.searching") : t("onboarding.noChannels")}
        </p>
      {:else}
        <div class="grid">
          {#each channels as channel (channel.name)}
            <button
              class="pick"
              class:on={selected.includes(channel.name)}
              onclick={() => toggle(channel.name)}
            >
              #{channel.name} <span class="count">{channel.postCount}</span>
            </button>
          {/each}
        </div>
      {/if}
      <button class="primary" onclick={finish} data-testid="onboarding-finish">
        {selected.length === 0
          ? t("onboarding.showAll")
          : selected.length === 1
            ? t("onboarding.showOne")
            : t("onboarding.showCount", { count: selected.length })}
      </button>
    </div>
  {/if}
</div>

<style>
  .screen {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.25rem;
  }
  .step {
    width: 100%;
    max-width: 24rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .center {
    align-items: center;
    text-align: center;
  }
  .glyph {
    width: 4rem;
    height: 4rem;
    overflow: visible;
  }
  .glyph path {
    stroke: var(--accent);
  }
  h1 {
    margin: 0;
    font-size: 1.3rem;
  }
  p {
    margin: 0;
    color: var(--text-muted);
  }
  .hint {
    font-size: 0.9rem;
    color: var(--text-muted);
  }
  .avatar-row {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
  }
  .grow {
    flex: 1;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  label em {
    font-style: normal;
    opacity: 0.7;
  }
  input,
  textarea {
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: 0.65rem;
    background: var(--surface);
    color: var(--text);
    font-size: 1rem;
    resize: none;
  }
  input:focus,
  textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  .error {
    color: var(--danger);
    font-size: 0.9rem;
  }
  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    max-height: 40dvh;
    overflow-y: auto;
  }
  .pick {
    padding: 0.45rem 0.85rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-muted);
    font-size: 0.9rem;
  }
  .pick.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-contrast);
  }
  .count {
    font-size: 0.75rem;
    opacity: 0.75;
  }
  .primary {
    margin-top: 0.25rem;
    padding: 0.8rem;
    border-radius: 0.65rem;
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 600;
  }
  .primary:disabled {
    opacity: 0.6;
  }
  .skip {
    color: var(--text-muted);
    font-size: 0.9rem;
    padding: 0.4rem;
  }
</style>
