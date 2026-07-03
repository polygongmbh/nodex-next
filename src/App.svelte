<script lang="ts">
  import { onMount } from "svelte";
  import { dismissSplash } from "@/lib/splash";
  import { authStore } from "@/stores/auth.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";
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

  // why: the relay connection lifecycle follows auth — signing in starts the
  // NDK service against the session's spaces, signing out tears it down.
  $effect(() => {
    if (authStore.status === "signedIn" && authStore.session) {
      timelineController.start(authStore.session);
    } else if (authStore.status === "signedOut") {
      timelineController.stop();
    }
  });
</script>

{#if authStore.status === "signedOut"}
  <SignInScreen />
{:else if authStore.status === "signedIn"}
  <TimelineScreen />
{/if}
