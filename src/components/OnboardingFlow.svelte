<script lang="ts">
  import { deriveChannels, spacesToPinChannelFor } from "@/domain/channel";
  import { defaultDisplayName } from "@/domain/person";
  import { t } from "@/lib/i18n/index.svelte";
  import { detectMobileOS } from "@/lib/pwa";
  import { authStore } from "@/stores/auth.svelte";
  import { preferencesStore } from "@/stores/preferences.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import AddSpace from "./AddSpace.svelte";
  import AvatarUpload from "./AvatarUpload.svelte";
  import PwaInstallHint from "./PwaInstallHint.svelte";

  import { onMount } from "svelte";

  // (Space →) profile → channels → (pwa). The space step appears only when the
  // detection ladder found nothing; the greeting lives in the profile heading
  // (no standalone welcome screen); the PWA step appears only on a mobile
  // browser that is not already installed. The timeline service already runs
  // behind this flow, so the channel step offers live channels.
  const username = $derived(authStore.session?.username ?? "");

  const showPwaStep = (() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return !standalone && detectMobileOS(navigator.userAgent, navigator.maxTouchPoints) !== null;
  })();

  let step = $state<"space" | "profile" | "channels" | "pwa">(
    (authStore.session?.relayUrls.length ?? 0) > 0 ? "profile" : "space"
  );

  // why: adding the first space (via AddSpace) updates the session — advance
  // out of the space step as soon as one exists.
  $effect(() => {
    if (step === "space" && (authStore.session?.relayUrls.length ?? 0) > 0) {
      step = "profile";
    }
  });

  let displayName = $state(defaultDisplayName(authStore.session?.username ?? ""));
  let about = $state("");
  let picture = $state("");
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
        picture = text(existing.picture) || authStore.profilePictureUrl || "";
      })
      .finally(() => (profileLoading = false));
  });

  let selected = $state<string[]>([]);
  let pendingPins = $state<Record<string, string[]>>({});
  const channels = $derived(deriveChannels(Object.values(timelineStore.postsById)));

  async function saveProfile() {
    if (saving) return;
    profileError = "";
    saving = true;
    try {
      // Website stays out of onboarding (it lives in the full editor); omitting
      // it here leaves any existing website on the kind-0 untouched.
      await timelineController.publishProfile({
        name: authStore.session?.username,
        displayName: displayName.trim() || defaultDisplayName(username),
        about,
        picture: picture.trim(),
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

  // Channels complete onboarding — unless a PWA step follows, in which case the
  // pins wait so flipping `onboarded` (which swaps in the timeline) happens last.
  function completeChannels() {
    const posts = Object.values(timelineStore.postsById);
    const allRelayIds = timelineStore.relays.map((relay) => relay.id);
    const pins = Object.fromEntries(
      selected.map((name) => [name, spacesToPinChannelFor(posts, name, allRelayIds)])
    );
    if (showPwaStep) {
      pendingPins = pins;
      step = "pwa";
    } else {
      preferencesStore.completeOnboarding(pins);
    }
  }

  function finishPwa() {
    preferencesStore.completeOnboarding(pendingPins);
  }
</script>

<div class="screen">
  {#if step === "space"}
    <div class="step">
      <h1>{t("onboarding.spaceTitle")}</h1>
      <p class="hint">{t("onboarding.spaceHint")}</p>
      <AddSpace />
    </div>
  {:else if step === "profile"}
    <div class="step">
      <h1>{t("onboarding.profileHeading", { name: username })}</h1>
      <p class="hint">{t("onboarding.personalize")}</p>
      {#if profileLoading}
        <p class="hint">{t("onboarding.fetching")}</p>
      {:else}
        <AvatarUpload
          bind:picture
          pubkey={authStore.session?.pubkeyHex ?? ""}
          label={displayName}
        />
        <label>
          <span>{t("profile.displayName")}</span>
          <input type="text" bind:value={displayName} data-testid="onboarding-display-name" />
        </label>
        <label>
          <span>{t("profile.bio")} <em>{t("common.optional")}</em></span>
          <textarea rows="3" bind:value={about} placeholder={t("profile.bioPlaceholder")}></textarea>
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
  {:else if step === "channels"}
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
      <button class="primary" onclick={completeChannels} data-testid="onboarding-finish">
        {selected.length === 0
          ? t("onboarding.showAll")
          : selected.length === 1
            ? t("onboarding.showOne")
            : t("onboarding.showCount", { count: selected.length })}
      </button>
    </div>
  {:else}
    <div class="step">
      <h1>{t("onboarding.pwaTitle")}</h1>
      <p class="hint">{t("onboarding.pwaHint")}</p>
      <PwaInstallHint />
      <button class="primary" onclick={finishPwa} data-testid="onboarding-finish-pwa">
        {t("onboarding.pwaDone")}
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
