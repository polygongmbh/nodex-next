<script lang="ts">
  import { authStore } from "@/stores/auth.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import { relayColorSlot } from "@/domain/relay-identity";
  import { i18n, t, type Locale } from "@/lib/i18n/index.svelte";
  import Avatar from "./Avatar.svelte";
  import ProfileSheet from "./ProfileSheet.svelte";
  import SpaceSelector from "./SpaceSelector.svelte";

  let { onClose }: { onClose: () => void } = $props();
  let profileOpen = $state(false);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onClose}></div>
<div class="sheet" data-testid="menu-sheet">
  <div class="grip"></div>
  <div class="user">
    <Avatar
      label={authStore.session?.username ?? "?"}
      pubkey={authStore.session?.pubkeyHex ?? ""}
      picture={authStore.profilePictureUrl ?? undefined}
    />
    <span class="username">{authStore.session?.username}</span>
    <button class="edit" onclick={() => (profileOpen = true)} data-testid="edit-profile">
      {t("profile.edit")}
    </button>
    <button class="signout" onclick={() => authStore.signOut()} data-testid="sign-out">
      {t("menu.signOut")}
    </button>
  </div>

  <h2>{t("menu.spaces")}</h2>
  <SpaceSelector />
  <ul>
    {#each timelineStore.relays as relay (relay.id)}
      <li>
        <span class="dot" style="background: var(--relay-{relayColorSlot(relay.id)})"></span>
        <span class="name">{relay.name}</span>
        <span class="state" class:online={relay.connected}>
          {relay.connected ? t("menu.connected") : t("space.offline")}
        </span>
      </li>
    {/each}
  </ul>

  <label class="language">
    <span>{t("menu.language")}</span>
    <select
      value={i18n.locale}
      onchange={(event) =>
        i18n.setLocale((event.currentTarget as HTMLSelectElement).value as Locale)}
    >
      <option value="en">English</option>
      <option value="de">Deutsch</option>
    </select>
  </label>
</div>

{#if profileOpen}
  <ProfileSheet onClose={() => (profileOpen = false)} />
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: hsl(0 0% 0% / 0.4);
    z-index: 40;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-width: 32rem;
    margin-inline: auto;
    z-index: 41;
    background: var(--surface);
    border-radius: 1rem 1rem 0 0;
    padding: 0.5rem 1.25rem calc(1rem + env(safe-area-inset-bottom));
    box-shadow: 0 -4px 24px hsl(0 0% 0% / 0.25);
    animation: slide-up 200ms ease-out;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  @keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  .grip {
    width: 2.5rem;
    height: 0.25rem;
    border-radius: 999px;
    background: var(--border);
    margin: 0.25rem auto 0;
  }
  .user {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }
  .username {
    font-weight: 600;
    flex: 1;
  }
  .edit {
    color: var(--accent);
    font-size: 0.85rem;
    padding: 0.4rem 0.6rem;
  }
  .signout {
    color: var(--danger);
    font-size: 0.85rem;
    padding: 0.4rem 0.6rem;
  }
  .language {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .language select {
    border: 1px solid var(--border);
    background: var(--bg);
    border-radius: 0.5rem;
    padding: 0.3rem 0.5rem;
  }
  h2 {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .dot {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 50%;
  }
  .name {
    flex: 1;
    font-weight: 500;
  }
  .state {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .state.online {
    color: var(--relay-1);
  }
</style>
