<script lang="ts">
  import { nip19 } from "nostr-tools";
  import { getPublicKey } from "nostr-tools/pure";
  import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
  import { authStore } from "@/stores/auth.svelte";
  import { NoasAuthError, splitNoasCredentials } from "@/infrastructure/noas/client";
  import { DEFAULT_NOAS_HOST } from "@/infrastructure/noas/config";
  import {
    resolveNoasDiscovery,
    type NoasEmailVerificationMode,
  } from "@/infrastructure/noas/discovery";
  import { vanityTargetFromUsername } from "@/lib/vanity-key";
  import { t } from "@/lib/i18n/index.svelte";

  let mode = $state<"signin" | "register">("signin");
  let username = $state("");
  let email = $state("");
  let password = $state("");
  let keyInput = $state("");
  let keyVisible = $state(false);
  let error = $state("");
  let info = $state("");
  let busy = $state(false);
  let mining = $state(false);
  let emailMode = $state<NoasEmailVerificationMode>("none");

  const host = $derived(splitNoasCredentials(username, "").host || DEFAULT_NOAS_HOST);

  /** Accept 64-hex or nsec; null when empty or unreadable. */
  const privateKeyHex = $derived.by(() => {
    const trimmed = keyInput.trim();
    if (!trimmed) return null;
    if (/^[a-f0-9]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
    if (trimmed.startsWith("nsec1")) {
      try {
        const decoded = nip19.decode(trimmed);
        if (decoded.type === "nsec") return bytesToHex(decoded.data as Uint8Array);
      } catch {
        return null;
      }
    }
    return null;
  });
  const npubPreview = $derived.by(() => {
    if (!privateKeyHex) return "";
    try {
      return nip19.npubEncode(getPublicKey(hexToBytes(privateKeyHex)));
    } catch {
      return "";
    }
  });

  // why: the email field only exists when the (possibly username-derived)
  // host requires verification — re-discover, debounced, as the user types.
  $effect(() => {
    if (mode !== "register") return;
    const currentHost = host;
    const timer = setTimeout(() => {
      void resolveNoasDiscovery(currentHost).then((discovery) => {
        if (host === currentHost) emailMode = discovery.emailVerificationMode;
      });
    }, 400);
    return () => clearTimeout(timer);
  });

  let miner: Worker | null = null;
  function stopMiner() {
    miner?.terminate();
    miner = null;
    mining = false;
  }
  function startMining(target: string, fillIfTyped: boolean) {
    stopMiner();
    mining = true;
    miner = new Worker(new URL("../lib/vanity-key.worker.ts", import.meta.url), {
      type: "module",
    });
    miner.onmessage = (event: MessageEvent<{ secretHex: string } | null>) => {
      const mined = event.data;
      // Never clobber a key the user typed/pasted in the meantime.
      if (mined && (fillIfTyped || !keyInput.trim())) keyInput = mined.secretHex;
      stopMiner();
    };
    miner.postMessage({ target });
  }

  // why: nodex's auto-mining — once the username has ≥4 chars and no key was
  // provided, mine a vanity key whose npub starts with the user's initials.
  $effect(() => {
    if (mode !== "register") return;
    const local = username.split("@")[0];
    if (local.length < 4 || keyInput.trim() || mining) return;
    const timer = setTimeout(() => startMining(vanityTargetFromUsername(local), false), 500);
    return () => clearTimeout(timer);
  });

  function generate() {
    if (mining) {
      // Impatient re-click: settle for a shorter prefix, faster.
      startMining(vanityTargetFromUsername(username, 2) || "0", true);
      return;
    }
    startMining(vanityTargetFromUsername(username) || "0", true);
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    error = "";
    info = "";
    if (mode === "register") {
      if (password.length < 8) {
        error = t("error.passwordLength");
        return;
      }
      if (emailMode === "required" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        error = t("error.emailRequired");
        return;
      }
      if (keyInput.trim() && !privateKeyHex) {
        error = t("error.invalidKey");
        return;
      }
    }
    busy = true;
    try {
      if (mode === "register") {
        const message = await authStore.register(username, password, {
          email: email.trim() || undefined,
          privateKeyHex: privateKeyHex ?? undefined,
        });
        if (message) info = t(message);
      } else {
        await authStore.signIn(username, password);
      }
    } catch (caught) {
      error = caught instanceof NoasAuthError ? t(caught.message) : t("error.generic");
    } finally {
      busy = false;
    }
  }
</script>

<div class="screen">
  <form class="card" onsubmit={submit}>
    <svg class="glyph" viewBox="0 0 220 220" data-splash-target>
      <g
        transform="translate(-54.08,-13.59) scale(1.12)"
        fill="none"
        stroke-width="31.104"
        stroke-linecap="round"
      >
        <path d="M90.4329 180.698L90.0113 86.1228C89.9973 82.9897 93.8252 81.4563 95.9781 83.7326L166.928 158.748" />
        <path d="M202.53 40.0443L202.952 134.619C202.966 137.752 199.138 139.286 196.985 137.01L126.035 61.9938" />
      </g>
    </svg>
    <h1>{t("app.welcome")}</h1>
    <p class="hint">{mode === "signin" ? t("signin.hint") : t("signin.registerHint")}</p>

    <div class="tabs">
      <button type="button" class:active={mode === "signin"} onclick={() => (mode = "signin")}>
        {t("signin.tab")}
      </button>
      <button
        type="button"
        class:active={mode === "register"}
        onclick={() => (mode = "register")}
        data-testid="register-tab"
      >
        {t("signin.registerTab")}
      </button>
    </div>

    <label>
      <span>{t("signin.username")}</span>
      <input
        type="text"
        bind:value={username}
        placeholder={t("signin.usernamePlaceholder")}
        autocapitalize="off"
        autocorrect="off"
        autocomplete="username"
        required
      />
      <small>{t("signin.usernameHint", { host })}</small>
    </label>
    {#if mode === "register" && emailMode === "required"}
      <label>
        <span>{t("signin.email")}</span>
        <input type="email" bind:value={email} autocomplete="email" required />
        <small>{t("signin.emailRequiredHint")}</small>
      </label>
    {/if}
    <label>
      <span>{t("signin.password")}</span>
      <input
        type="password"
        bind:value={password}
        autocomplete={mode === "register" ? "new-password" : "current-password"}
        required
      />
      {#if mode === "register"}<small>{t("signin.passwordHint")}</small>{/if}
    </label>

    {#if mode === "register"}
      <label>
        <span>{t("signin.privateKey")} <em>{t("common.optional")}</em></span>
        <div class="key-row">
          <input
            type="text"
            class="key-input"
            class:masked={!keyVisible}
            bind:value={keyInput}
            placeholder={t("signin.privateKeyPlaceholder")}
            autocapitalize="off"
            autocorrect="off"
            autocomplete="off"
            spellcheck="false"
            data-testid="private-key"
          />
          <button type="button" class="key-btn" onclick={() => (keyVisible = !keyVisible)}>
            {keyVisible ? "🙈" : "👁"}
          </button>
          <button type="button" class="key-btn generate" onclick={generate} data-testid="generate-key">
            {mining ? t("signin.mining") : t("signin.generate")}
          </button>
        </div>
        {#if npubPreview}
          <small class="npub">{t("signin.publicKey")}: {npubPreview}</small>
        {/if}
      </label>
      <p class="footer-note">{t("signin.keysFooter")}</p>
    {/if}

    {#if error}<p class="error">{error}</p>{/if}
    {#if info}<p class="info">{info}</p>{/if}

    <button class="submit" type="submit" disabled={busy}>
      {busy
        ? t(mode === "register" ? "signin.registering" : "signin.submitting")
        : t(mode === "register" ? "signin.register" : "signin.submit")}
    </button>
  </form>
</div>

<style>
  .screen {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.25rem;
    padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
  }
  .card {
    width: 100%;
    max-width: 22rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .glyph {
    width: 3.5rem;
    height: 3.5rem;
    align-self: center;
    overflow: visible;
  }
  .glyph path {
    stroke: var(--brand);
  }
  h1 {
    margin: 0;
    text-align: center;
    font-size: 1.35rem;
  }
  .hint {
    margin: -0.5rem 0 0;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.9rem;
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
  label small {
    font-size: 0.75rem;
    opacity: 0.8;
  }
  .npub {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--accent-strong);
  }
  input {
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: 0.65rem;
    background: var(--surface);
    color: var(--text);
    font-size: 1rem;
  }
  input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: transparent;
  }
  .key-row {
    display: flex;
    gap: 0.35rem;
  }
  .key-input {
    flex: 1;
    min-width: 0;
    font-size: 0.85rem;
  }
  .key-input.masked {
    -webkit-text-security: disc;
  }
  .key-btn {
    padding: 0 0.6rem;
    border: 1px solid var(--border);
    border-radius: 0.65rem;
    background: var(--surface);
    font-size: 0.8rem;
    flex-shrink: 0;
  }
  .key-btn.generate {
    color: var(--accent-strong);
    font-weight: 600;
  }
  .footer-note {
    margin: -0.4rem 0 0;
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
  }
  .tabs {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 0.65rem;
    overflow: hidden;
  }
  .tabs button {
    flex: 1;
    padding: 0.55rem;
    font-size: 0.9rem;
    color: var(--text-muted);
    background: var(--surface);
  }
  .tabs button.active {
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 600;
  }
  .error {
    margin: 0;
    color: var(--danger);
    font-size: 0.9rem;
  }
  .info {
    margin: 0;
    color: var(--relay-1);
    font-size: 0.9rem;
  }
  .submit {
    margin-top: 0.25rem;
    padding: 0.8rem;
    border-radius: 0.65rem;
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 600;
  }
  .submit:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
