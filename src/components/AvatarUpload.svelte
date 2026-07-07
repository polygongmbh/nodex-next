<script lang="ts">
  import { t } from "@/lib/i18n/index.svelte";
  import { resizeImage } from "@/lib/image";
  import { authStore } from "@/stores/auth.svelte";
  import { NoasAuthError, uploadNoasProfilePicture } from "@/infrastructure/noas/client";
  import Avatar from "./Avatar.svelte";

  // Upload-first avatar editor: accounts are noas-hosted, so a photo goes
  // straight to noas (POST /auth/update); the image-URL field is tucked behind
  // a disclosure. Uploads need the session's password hash — present after a
  // fresh sign-in, absent after a restore of a pre-existing session — so when
  // it is missing we fall back to the URL field.
  let { picture = $bindable(""), pubkey, label }: {
    picture: string;
    pubkey: string;
    label: string;
  } = $props();

  const canUpload = $derived(Boolean(authStore.session?.passwordHash));
  let fileInput = $state<HTMLInputElement | null>(null);
  let localPreview = $state("");
  let uploading = $state(false);
  let error = $state("");
  let showUrl = $state(!authStore.session?.passwordHash);

  async function onPick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ""; // allow re-picking the same file
    const session = authStore.session;
    if (!file || !session) return;
    if (!session.passwordHash) {
      error = "profile.pictureNeedsSignin";
      showUrl = true;
      return;
    }
    error = "";
    uploading = true;
    try {
      const { dataUrl, contentType } = await resizeImage(file);
      picture = await uploadNoasProfilePicture(
        session.apiBaseUrl,
        session.username,
        session.passwordHash,
        session.pubkeyHex,
        dataUrl,
        contentType
      );
      localPreview = dataUrl; // instant feedback; the stored URL serves the same image
    } catch (caught) {
      error = caught instanceof NoasAuthError ? caught.message : "profile.pictureUploadError";
    } finally {
      uploading = false;
    }
  }
</script>

<div class="avatar-upload">
  <div class="row">
    <button
      type="button"
      class="avatar-btn"
      class:actionable={canUpload}
      onclick={() => canUpload && fileInput?.click()}
      disabled={uploading}
    >
      <Avatar label={label || "?"} {pubkey} picture={localPreview || picture || undefined} />
      {#if uploading}<span class="spinner"></span>{/if}
    </button>
    <div class="actions">
      {#if canUpload}
        <button type="button" class="upload" onclick={() => fileInput?.click()} disabled={uploading}>
          {uploading ? t("profile.uploading") : t("profile.pictureUpload")}
        </button>
      {/if}
      <button type="button" class="link" onclick={() => (showUrl = !showUrl)}>
        {showUrl ? t("profile.pictureHideUrl") : t("profile.pictureUseUrl")}
      </button>
    </div>
  </div>

  <input bind:this={fileInput} type="file" accept="image/*" onchange={onPick} hidden />

  {#if showUrl}
    <label class="url">
      <span>{t("profile.picture")}</span>
      <input type="url" bind:value={picture} placeholder="https://…" />
    </label>
  {/if}
  {#if !canUpload}
    <p class="hint">{t("profile.pictureNeedsSignin")}</p>
  {/if}
  {#if error}
    <p class="error">{t(error)}</p>
  {/if}
</div>

<style>
  .avatar-upload {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }
  .avatar-btn {
    position: relative;
    border-radius: 50%;
    padding: 0;
    background: none;
    line-height: 0;
  }
  .avatar-btn.actionable {
    cursor: pointer;
  }
  .avatar-btn.actionable:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .avatar-btn:disabled {
    opacity: 0.7;
  }
  .spinner {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 1.1rem;
    height: 1.1rem;
    border: 2px solid var(--accent-contrast);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3rem;
  }
  .upload {
    padding: 0.5rem 0.9rem;
    border-radius: 0.6rem;
    background: var(--accent);
    color: var(--accent-contrast);
    font-size: 0.9rem;
    font-weight: 600;
  }
  .upload:disabled {
    opacity: 0.6;
  }
  .link {
    color: var(--text-muted);
    font-size: 0.8rem;
    text-decoration: underline;
    padding: 0.1rem 0;
  }
  .url {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .url input {
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: 0.65rem;
    background: var(--surface);
    color: var(--text);
    font-size: 1rem;
  }
  .url input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  .hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .error {
    margin: 0;
    color: var(--danger);
    font-size: 0.85rem;
  }
</style>
