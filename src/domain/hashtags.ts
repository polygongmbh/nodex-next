// Channels are hashtags: a post's channels = `t`-tags ∪ in-content #hashtags,
// lowercased. Hex color tokens (#fff, #1a2b3c) are not hashtags.

const HASHTAG_CONTENT_REGEX = /(^|\s)#([\p{L}\p{N}_-]+)/gu;

export function isHexColorToken(raw: string): boolean {
  return /^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw);
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

/** Union of `t`-tags and in-content hashtags, lowercased and deduped. */
export function deriveChannelTags(tags: string[][], content: string): string[] {
  const channels = new Set<string>();
  for (const tag of tags) {
    if (tag[0] === "t" && tag[1]?.trim()) {
      channels.add(tag[1].trim().toLowerCase());
    }
  }
  for (const hashtag of extractHashtagsFromContent(content)) {
    channels.add(hashtag);
  }
  return Array.from(channels);
}
