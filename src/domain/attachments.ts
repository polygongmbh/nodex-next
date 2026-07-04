// Media attachments (NIP-92 imeta tags, with NIP-94-style top-level tags as
// fallback). On publish, Nodex turns body media URLs into imeta tags — this
// is the parse side of that contract.

export interface Attachment {
  url: string;
  mimeType?: string;
  sha256?: string;
  size?: number;
}

function parseSize(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const size = Number(value);
  return Number.isFinite(size) && size >= 0 ? size : undefined;
}

export function parseAttachments(tags: string[][]): Attachment[] {
  const attachments: Attachment[] = [];

  for (const tag of tags) {
    if (tag[0] !== "imeta") continue;
    const fields = new Map<string, string>();
    for (const entry of tag.slice(1)) {
      const space = entry.indexOf(" ");
      if (space <= 0) continue;
      fields.set(entry.slice(0, space), entry.slice(space + 1));
    }
    const url = fields.get("url");
    if (!url) continue;
    attachments.push({
      url,
      mimeType: fields.get("m"),
      sha256: fields.get("x"),
      size: parseSize(fields.get("size")),
    });
  }

  // NIP-94-style top-level tags describe a single attachment.
  const topLevel = (name: string) => tags.find((tag) => tag[0] === name && tag[1])?.[1];
  const url = topLevel("url");
  if (url && !attachments.some((attachment) => attachment.url === url)) {
    attachments.push({
      url,
      mimeType: topLevel("m"),
      sha256: topLevel("x"),
      size: parseSize(topLevel("size")),
    });
  }

  return attachments;
}
