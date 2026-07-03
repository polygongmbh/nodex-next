<script lang="ts">
  import { onMount } from "svelte";
  import { dismissSplash } from "@/lib/splash";
  import { authStore } from "@/stores/auth.svelte";
  import { preferencesStore } from "@/stores/preferences.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import OnboardingFlow from "@/components/OnboardingFlow.svelte";
  import SignInScreen from "@/components/SignInScreen.svelte";
  import TimelineScreen from "@/components/TimelineScreen.svelte";

  onMount(() => {
    authStore.restoreSession();
    return () => timelineController.stop();
  });

  // why: the splash overlay stays until session restore has decided which
  // screen to show, so the sign-in dialogue (or timeline) is the first thing
  // revealed by the stroke animation.
  $effect(() => {
    if (authStore.status !== "restoring") dismissSplash();
  });

  // why: the relay connection lifecycle follows auth — signing in loads the
  // account's preferences and starts the NDK service against the session's
  // spaces (also while onboarding, so channel picks come live); signing out
  // tears both down.
  $effect(() => {
    if (authStore.status === "signedIn" && authStore.session) {
      preferencesStore.load(authStore.session.pubkeyHex);
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
  {#if preferencesStore.onboarded}
    <TimelineScreen />
  {:else}
    <OnboardingFlow />
  {/if}
{/if}
