<script lang="ts">
  import type { Post, TaskStateUpdate } from "@/domain/post";
  import { stateUpdateLabel, statusFromKind } from "@/domain/post";
  import { personLabel } from "@/domain/person";
  import { formatTimelineTimestamp } from "@/domain/timeline-timestamp";
  import { timelineStore } from "@/stores/timeline.svelte";
  import StatusIcon from "./StatusIcon.svelte";

  let { post, update }: { post: Post; update: TaskStateUpdate } = $props();

  const author = $derived(timelineStore.peopleByPubkey[update.pubkey]);
  const status = $derived(statusFromKind(update.kind, update.content) ?? "open");
</script>

<div class="row">
  <StatusIcon {status} size={16} />
  <span class="label">{stateUpdateLabel(update)}</span>
  <span class="sep">·</span>
  <span class="author">{personLabel(author, update.pubkey)}</span>
  <span class="sep">·</span>
  <span class="task">{post.content}</span>
  <time>{formatTimelineTimestamp(new Date(update.timestamp * 1000))}</time>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 1rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    font-size: 0.875rem;
    min-width: 0;
  }
  .label {
    font-weight: 600;
    flex-shrink: 0;
  }
  .sep {
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .author {
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .task {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
  time {
    margin-left: auto;
    flex-shrink: 0;
    color: var(--text-muted);
    font-size: 0.75rem;
  }
</style>
