<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { dismissSplash } from "@/lib/splash";
  import { startWakeWatcher } from "@/lib/wake-watcher";
  import { hasExistingProfileContent } from "@/domain/person";
  import { parsePostPermalink } from "@/domain/permalink";
  import { normalizeRelayUrl } from "@/domain/relay-identity";
  import { authStore } from "@/stores/auth.svelte";
  import { filterStore } from "@/stores/filters.svelte";
  import { preferencesStore } from "@/stores/preferences.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import type { StoredSession } from "@/infrastructure/noas/session";
  import OnboardingFlow from "@/components/OnboardingFlow.svelte";
  import SignInScreen from "@/components/SignInScreen.svelte";
  import TimelineScreen from "@/components/TimelineScreen.svelte";

  let checkingProfile = $state(false);
  // A shared permalink (`/relayHost/eventId`) is resolved exactly once per boot.
  let permalinkChecked = false;

  function relayHostOf(url: string): string | null {
    const normalized = normalizeRelayUrl(url);
    try {
      return normalized ? new URL(normalized).hostname : null;
    } catch {
      return null;
    }
  }

  // Open the thread named by the boot URL: focus the post, and drop the path so
  // a reload doesn't re-trigger. If the link names a relay host no session space
  // matches, add it as a space first (restarts the relay service — acceptable
  // during startup, and it resets filter state, so focus the thread afterwards).
  function resolvePermalink(session: StoredSession): void {
    if (permalinkChecked) return;
    permalinkChecked = true;
    const parsed = parsePostPermalink(window.location.pathname);
    if (!parsed) return;
    if (parsed.relayHost) {
      const known = session.relayUrls.some((url) => relayHostOf(url) === parsed.relayHost);
      if (!known) {
        const updated = authStore.addRelayUrl(`wss://${parsed.relayHost}`);
        if (updated) timelineController.restart(updated);
      }
    }
    filterStore.focusThread(parsed.postId);
    window.history.replaceState(null, "", "/");
  }

  onMount(() => {
    authStore.restoreSession();
    // System sleep / tab inactivity kills relay sockets in ways NDK doesn't
    // recover from; the watcher rebuilds the relay service (a no-op while
    // signed out) so relays reconnect and missed events are refetched.
    const stopWakeWatcher = startWakeWatcher({
      anyRelayOffline: () => timelineStore.relays.some((relay) => !relay.connected),
      resync: () => timelineController.resync(),
    });
    return () => {
      stopWakeWatcher();
      timelineController.stop();
    };
  });

  // why: the splash overlay stays until session restore has decided which
  // screen to show AND the relay profile check (for a fresh device) has
  // resolved, so the sign-in dialogue (or timeline) is the first thing
  // revealed by the stroke animation, never a flash of OnboardingFlow.
  $effect(() => {
    if (authStore.status !== "restoring" && !checkingProfile) dismissSplash();
  });

  // why: the relay connection lifecycle follows auth — signing in loads the
  // account's preferences and starts the NDK service against the session's
  // spaces (also while onboarding, so channel picks come live); signing out
  // tears both down.
  $effect(() => {
    if (authStore.status === "signedIn" && authStore.session) {
      // why: load() writes prefs state and the checks below read it back —
      // untrack keeps this lifecycle effect keyed to auth alone, else the
      // read-write cycle on `onboarded` loops the effect until Svelte kills
      // the flush (effect_update_depth_exceeded) and the UI freezes.
      untrack(() => {
        preferencesStore.load(authStore.session!.pubkeyHex);
        // why: manual dev/test entry point — visiting /onboarding re-runs the
        // flow in-memory only (never persists) so onboarding changes can be
        // retried without clearing localStorage; a refresh keeps re-forcing it.
        const forcedByUrl = window.location.pathname === "/onboarding";
        if (forcedByUrl) preferencesStore.onboarded = false;
        // why: the local onboarded flag is a per-device fast path; when it is
        // unset (fresh browser/device) confirm it against the relay's own kind-0
        // so an account already set up elsewhere skips onboarding instead of
        // being re-run. The URL dev-trigger deliberately bypasses this, and with
        // zero relays the fetch can confirm nothing (it just burns ~3s of splash),
        // so skip it — onboarding opens at the space step regardless.
        if (
          !preferencesStore.onboarded &&
          !forcedByUrl &&
          authStore.session!.relayUrls.length > 0
        ) {
          checkingProfile = true;
          timelineController
            .fetchOwnProfile()
            .then((content) => {
              if (hasExistingProfileContent(content)) preferencesStore.confirmOnboarded();
            })
            // why: a rejected fetch (relay/connection error) must not silently
            // skip setup — leave onboarded false so onboarding shows.
            .catch(() => {})
            .finally(() => {
              checkingProfile = false;
            });
        }
      });
      timelineController.start(authStore.session);
      // why: a shared-link deep focus resolves once the session (and its spaces)
      // are known — after start, so an added space's restart keeps the focus.
      untrack(() => resolvePermalink(authStore.session!));
    } else if (authStore.status === "signedOut") {
      timelineController.stop();
      preferencesStore.reset();
    }
  });
</script>

{#if authStore.status === "signedOut"}
  <SignInScreen />
{:else if authStore.status === "signedIn"}
  {#if checkingProfile}
    <!-- Splash still covers the screen while the relay profile check runs. -->
  {:else if preferencesStore.onboarded}
    <TimelineScreen />
  {:else}
    <OnboardingFlow />
  {/if}
{/if}
