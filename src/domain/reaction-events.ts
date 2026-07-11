// NIP-25 reactions (kind 7), wire-compatible with the original nodex app:
// "+" / "" count as 👍, "-" as 👎, any single emoji grapheme passes through,
// everything else (words, :shortcodes:) is ignored — no NIP-30 custom emoji.

export interface Reaction {
  id: string;
  /** The reacted-to event (last `e`-tag per NIP-25). */
  targetId: string;
  pubkey: string;
  /** Normalized display emoji, never "+"/"-"/"". */
  emoji: string;
  /** Relay ids that delivered this reaction — per-relay attribution. */
  relays: string[];
  timestamp: number; // unix seconds
}

/** Quick-pick reactions offered in the UI — same registry as the original nodex. */
export const QUICK_REACTION_EMOJIS = [
  "👍",
  "❤️",
  "🎉",
  "😄",
  "🚀",
  "👀",
  "🙏",
  "🙌",
  "🛠️",
  "👎",
] as const;

/** NIP-25 wire content for a display emoji: "+"/"-" for the thumbs, else verbatim. */
export function reactionContentFor(emoji: string): string {
  if (emoji === "👍") return "+";
  if (emoji === "👎") return "-";
  return emoji;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** NIP-25 content → displayed emoji; undefined = unsupported, drop the event. */
export function normalizeReactionEmoji(content: string): string | undefined {
  const trimmed = content.trim();
  if (trimmed === "" || trimmed === "+") return "👍";
  if (trimmed === "-") return "👎";
  const graphemes = Array.from(segmenter.segment(trimmed), (part) => part.segment);
  if (graphemes.length !== 1) return undefined;
  // A lone ASCII character ("x", "?") is not an emoji reaction.
  if (/^[\x00-\x7f]$/.test(graphemes[0])) return undefined;
  return graphemes[0];
}

/**
 * Tags of an outgoing reaction: NIP-25 `e` (with relay hint and target
 * author), `p` for the notified author, `k` for the target's kind.
 */
export function buildReactionTags(
  target: { id: string; pubkey: string; kind: number },
  relayHint = ""
): string[][] {
  return [
    ["e", target.id, relayHint, target.pubkey],
    ["p", target.pubkey],
    ["k", String(target.kind)],
  ];
}
