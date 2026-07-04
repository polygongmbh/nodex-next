// Channels are hashtags: a post's channels = `t`-tags ∪ in-content #hashtags,
// lowercased. Hex color tokens (#FEE, #123FEF) are not hashtags.

const HASHTAG_CONTENT_REGEX = /(^|\s)#([\p{L}\p{N}_-]+)/gu;

/**
 * A color token is UPPERCASE hex or pure digits of length 3/4/6/8 — so
 * lowercase tags like `#fee` stay hashtags while colors are written `#FEE`,
 * and digit-only sequences (`#123`, `#123456`) read as colors, not tags.
 */
export function isHexColorToken(raw: string): boolean {
  if (raw.length !== 3 && raw.length !== 4 && raw.length !== 6 && raw.length !== 8) return false;
  return /^[0-9A-F]+$/.test(raw);
}

export function extractHashtagsFromContent(content: string): string[] {
  const hashtags = new Set<string>();
  for (const match of content.matchAll(HASHTAG_CONTENT_REGEX)) {
    const raw = match[2];
    if (!raw || isHexColorToken(raw)) continue;
    hashtags.add(raw.toLowerCase());
  }
  return Array.from(hashtags);
}

/** Union of `t`/`T` tags and in-content hashtags, lowercased and deduped. */
export function deriveChannelTags(tags: string[][], content: string): string[] {
  const channels = new Set<string>();
  for (const tag of tags) {
    if ((tag[0] === "t" || tag[0] === "T") && tag[1]?.trim()) {
      channels.add(tag[1].trim().toLowerCase());
    }
  }
  for (const hashtag of extractHashtagsFromContent(content)) {
    channels.add(hashtag);
  }
  return Array.from(channels);
}
