# File attachments — design doc (deferred)

Status: **not implemented.** This is the plan for adding **file (media)
attachments** to composed messages, the second attachment type after calendar
events (which shipped). It is written to be picked up as a self-contained
follow-up. The behavioral reference is the original nodex, which already does
all of this; the parse side already exists in both rewrites.

## Why deferred

There is **no media-upload host configured** in either client today
(`VITE_NIP96_UPLOAD_URL` unset; nodex-talk has only the noas profile-picture
endpoint, not a general host). File upload cannot be exercised end-to-end until
a host is chosen, so the upload/UI work is split out from the composer feature.
The wire contract (`imeta`) and the parse side are already settled, so this is
purely additive.

## What already exists (parse side — do not rebuild)

- nodex-next `src/domain/attachments.ts` — `parseAttachments(tags)` reads NIP-92
  `imeta` tags (`url`/`m`/`x`/`size`) plus a single NIP-94-style top-level
  attachment. `Post.attachments` is populated at classify time. **Not rendered.**
- nodex-talk `lib/infrastructure/nostr/event_converter.dart` — `extractImageUrls`
  (imeta + bare image URLs); rendered by `lib/ui/timeline/attachment_images.dart`.
- The doc contract: `docs/nostr-extensions.md` §"Media attachments" — "on publish,
  Nodex turns body media URLs into `imeta` tags."

The reference implementation to port: `nodex/src/lib/attachments.ts`
(`buildImetaTag`, `parseImetaTag`, `normalizePublishedAttachments`,
`isImageAttachment`, `guessMimeTypeFromUrl`) and
`nodex/src/lib/nostr/nip96-attachment-upload.ts` (`uploadAttachment`,
`isAttachmentUploadConfigured`, `getAttachmentMaxFileSizeBytes`).

## Open decision — upload backend (needs a host)

| Option | Notes |
| --- | --- |
| **NIP-96** (recommended) | Reuse the reference `uploadAttachment`: multipart POST to `VITE_NIP96_UPLOAD_URL`, NIP-98 `Authorization` header (signed kind-27235 event), response gives a URL + optional `nip94_event` tags. Zero net-new design — the reference is battle-tested. Needs a configured NIP-96 server. |
| **Blossom** (BUD-01/02) | Content-addressed by sha256; PUT `/upload` with a signed auth event; URL is `<server>/<sha256>`. Cleaner dedup, but no existing implementation to port. |

Recommendation: **NIP-96**, since the whole client path already exists in the
reference and only needs porting. Gate all attach-file UI behind
`isAttachmentUploadConfigured()` so nothing appears until a host is set.

## Plan (spec-vector-first, then both clients)

### 1. Spec vector — `spec/vectors/attachments.json` (new)
`buildImetaTag` build cases + a parse round-trip against `parseAttachments`:
- url + mimeType + sha256 + size → `["imeta","url …","m …","x …","size …"]`
  (NIP-92 requires url plus ≥1 field; a bare url yields no tag).
- ordering + which fields are emitted; dimensions/alt/name if we keep them.
Add adapters: nodex-next `vectors-domain.test.ts`; nodex-talk
`test/vectors_attachments_test.dart`.

### 2. Domain — `buildImetaTag`
- nodex-next: extend `src/domain/attachments.ts` with `buildImetaTag(attachment):
  string[]` (port the reference; keep it symmetric with `parseAttachments`). The
  `Attachment` type may need `dim`/`alt`/`name` fields if we surface them.
- nodex-talk: add `buildImetaTag` in `lib/domain/` and extend the `Attachment`
  model to carry mime/sha/size (currently only image URLs are modeled).

### 3. Infrastructure — NIP-96 uploader
- nodex-next: new `src/infrastructure/media/nip96-upload.ts` — port
  `uploadAttachment(file, { uploadUrl, getAuthHeader })`; the auth header is a
  NIP-98 event signed via the NDK service (add a `signAuthEvent(url, method)` to
  `ndk-service.ts`). Config: `VITE_NIP96_UPLOAD_URL`, `VITE_NIP96_MAX_UPLOAD_BYTES`.
- nodex-talk: new `lib/infrastructure/nostr/nip96_upload.dart` — multipart via
  `http`/`dio`; NIP-98 auth via ndk signing; file pick via the existing
  `image_picker` (already used in onboarding) plus a general file picker.

### 4. Publish integration
- `buildMessageTags(channels, parent?, attachments?)` gains attachments → append
  one `imeta` tag per uploaded attachment. In `sendMessage`/`publishMessage`,
  append each attachment URL to the content (so non-imeta clients still show it;
  matches the "body media URLs → imeta" contract). Calendar events can carry
  attachments too (same imeta tags on the 3192x event) — optional.

### 5. Composer UI (gated on `isAttachmentUploadConfigured()`)
- Attach-file button next to the calendar attach button.
- File input → per-file upload with states: `uploading` (spinner/progress) →
  `uploaded` (thumbnail for images, name+size chip for others) → `error` (retry).
- Remove control per attachment; block send while any attachment is `uploading`.
- Persist uploaded attachments with the draft (optional, matches reference).
- Strings in both i18n dictionaries: attach-file, uploading, upload-failed,
  max-size-exceeded, upload-not-configured.

### 6. Render (make attachments visible)
- nodex-next: render `post.attachments` in `TimelineCard.svelte` — inline images
  (with `isImageAttachment`), else a file chip/link. (Also renders on
  `CalendarCard` if calendar attachments are added.)
- nodex-talk: `post.imageUrls` already renders via `AttachmentImages`; extend to
  non-image attachments as file chips.

## Verification (when built)
- Unit: `buildImetaTag` round-trips `parseAttachments`; the shared vector passes
  in both suites.
- Manual (needs a host): configure `VITE_NIP96_UPLOAD_URL`, attach an image +
  a non-image file, send, confirm the event carries `imeta` tags + the URL in
  content, and both render inline/as a chip in the feed and in the other client.

## Questions for the product owner
1. Which upload host / backend (NIP-96 vs Blossom), and is a server available?
2. Max upload size and allowed types? (reference default: 100 MB, any type.)
3. Should calendar events also accept file attachments, or messages only?
