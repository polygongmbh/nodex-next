<script lang="ts">
  import { personInitials, pubkeyHue } from "@/domain/person";

  let { label, pubkey, picture }: { label: string; pubkey: string; picture?: string } = $props();

  let failed = $state(false);

  // why: a new picture URL must get a fresh load attempt — reset the failed
  // flag when the src changes, else a prior 404 keeps the new image hidden.
  $effect(() => {
    picture; // track the prop
    failed = false;
  });
</script>

{#if picture && !failed}
  <img class="avatar" src={picture} alt={label} onerror={() => (failed = true)} />
{:else}
  <div class="avatar placeholder" style="--hue: {pubkeyHue(pubkey)}">
    {personInitials(label)}
  </div>
{/if}

<style>
  .avatar {
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: hsl(var(--hue) 55% 45%);
    color: white;
    font-size: 0.8rem;
    font-weight: 600;
  }
</style>
