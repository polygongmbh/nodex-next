<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { dismissSplash } from "@/lib/splash";
  import { hasExistingProfileContent } from "@/domain/person";
  import { authStore } from "@/stores/auth.svelte";
  import { preferencesStore } from "@/stores/preferences.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import OnboardingFlow from "@/components/OnboardingFlow.svelte";
  import SignInScreen from "@/components/SignInScreen.svelte";
  import TimelineScreen from "@/components/TimelineScreen.svelte";

  let checkingProfile = $state(false);

  onMount(() => {
    authStore.restoreSession();
    return () => timelineController.stop();
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
        // being re-run. The URL dev-trigger deliberately bypasses this.
        if (!preferencesStore.onboarded && !forcedByUrl) {
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
