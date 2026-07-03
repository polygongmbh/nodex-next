// Splits post content into renderable tokens so URLs become links and
// hashtags become channel-styled spans without any HTML injection.

import { isHexColorToken } from "./hashtags";

export type ContentToken =
  | { type: "text"; value: string }
  | { type: "url"; value: string }
  | { type: "hashtag"; value: string }; // value without the leading #

const TOKEN_REGEX = /(https?:\/\/[^\s]+)|(^|\s)#([\p{L}\p{N}_-]+)/gu;

export function tokenizeContent(content: string): ContentToken[] {
  const tokens: ContentToken[] = [];
  let cursor = 0;
  for (const match of content.matchAll(TOKEN_REGEX)) {
    const [full, url, boundary, hashtag] = match;
    if (hashtag && isHexColorToken(hashtag)) continue;
    if (match.index > cursor) {
      tokens.push({ type: "text", value: content.slice(cursor, match.index) });
    }
    if (url) {
      tokens.push({ type: "url", value: url });
    } else {
      if (boundary) tokens.push({ type: "text", value: boundary });
      tokens.push({ type: "hashtag", value: hashtag });
    }
    cursor = match.index + full.length;
  }
  if (cursor < content.length) {
    tokens.push({ type: "text", value: content.slice(cursor) });
  }
  return tokens;
}
