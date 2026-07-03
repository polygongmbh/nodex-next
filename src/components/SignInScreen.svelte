<script lang="ts">
  import { authStore } from "@/stores/auth.svelte";
  import { NoasAuthError } from "@/infrastructure/noas/client";
  import { t } from "@/lib/i18n/index.svelte";

  let mode = $state<"signin" | "register">("signin");
  let host = $state(authStore.lastHost);
  let username = $state("");
  let email = $state("");
  let password = $state("");
  let confirm = $state("");
  let error = $state("");
  let info = $state("");
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    error = "";
    info = "";
    if (mode === "register" && password !== confirm) {
      error = t("signin.passwordMismatch");
      return;
    }
    busy = true;
    try {
      if (mode === "register") {
        const message = await authStore.register(host, username, password, email);
        if (message) info = t(message);
      } else {
        await authStore.signIn(host, username, password);
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
    <svg class="glyph" viewBox="0 0 220 220">
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
    <p class="hint">
{mode === "signin" ? t("signin.hint") : t("signin.registerHint")}
    </p>

    <div class="tabs">
      <button
        type="button"
        class:active={mode === "signin"}
        onclick={() => (mode = "signin")}
      >
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
    </label>
    <label>
      <span>{t("signin.server")} <em>{t("signin.serverOptional")}</em></span>
      <input
        type="text"
        bind:value={host}
        placeholder="your-org.example"
        autocapitalize="off"
        autocorrect="off"
      />
    </label>
    {#if mode === "register"}
      <label>
        <span>{t("signin.email")} <em>{t("signin.emailOptional")}</em></span>
        <input type="email" bind:value={email} autocomplete="email" />
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
    </label>
    {#if mode === "register"}
      <label>
        <span>{t("signin.confirm")}</span>
        <input type="password" bind:value={confirm} autocomplete="new-password" required />
      </label>
    {/if}

    {#if error}
      <p class="error">{error}</p>
    {/if}
    {#if info}
      <p class="info">{info}</p>
    {/if}

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
    stroke: var(--accent);
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
