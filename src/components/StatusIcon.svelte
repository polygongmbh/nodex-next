<script lang="ts">
  import type { TaskStatus } from "@/domain/post";

  let { status, size = 18 }: { status: TaskStatus; size?: number } = $props();
</script>

<svg
  class="icon {status}"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
>
  <circle cx="12" cy="12" r="9" />
  {#if status === "active"}
    <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
  {:else if status === "done"}
    <path d="M8 12.5l2.6 2.6L16 9.5" />
  {:else if status === "closed"}
    <path d="M7 7l10 10" />
  {/if}
</svg>

<style>
  .icon {
    flex-shrink: 0;
    display: block;
  }
  .open,
  .closed {
    color: var(--text-muted);
  }
  .active {
    color: var(--relay-2);
  }
  .done {
    color: var(--accent);
  }
</style>
