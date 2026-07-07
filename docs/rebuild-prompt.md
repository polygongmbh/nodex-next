# Rebuild prompt — Nodex Next (web)

A self-contained prompt to build this application from scratch. Everything
normative is in here; where a detail is ambiguous, match the behavior notes
in the repo README.

---

Build **Nodex Next**: a Nostr-native team-messaging web app focused on ONE
view — the mobile-first Timeline — with a desktop sidebar layout at ≥900px.
It must be event-compatible with nodex/mostr on the same relay.

## Stack

- Svelte 5 (runes) + Vite + TypeScript, vitest for tests. No router, no
  Tailwind, no CSS framework: scoped component styles plus a single design
  token sheet (light/dark via `prefers-color-scheme`).
- `@nostr-dev-kit/ndk` v3 for relay pool, signing, subscriptions ONLY.
  `nostr-tools` for nip19/nip49, `@noble/hashes` for sha256.
- Layers with strict dependency direction — components → stores →
  infrastructure → domain:
  - `src/domain/`: pure dependency-free TS (no Svelte/NDK/browser). Fully
    unit-tested; this layer is the spec.
  - `src/infrastructure/`: noas client + NDK service. Throws typed errors.
  - `src/stores/`: rune-class stores (`.svelte.ts`); controllers expose
    commands only, never setters.
  - `src/components/`: one component per file. Max ~300 lines per file.

## Hard requirements

1. **Per-relay attribution.** Every post records which relay ids delivered
   it. NDK's event cache stays disabled; the timeline store ingests from
   both `event` and `event:dup` subscription callbacks and UNION-merges
   relay ids into existing posts (same id ⇒ same signed event; a re-ingest
   only carries new attribution — never overwrite folded state). Events
   without a delivering relay are dropped. UI: colored dots per relay
   (stable 8-slot palette hashed from relay id) opening a "Delivered by"
   bottom sheet.
2. **Noas sign-in is the entry dialogue**, right after the splash: a
   two-stroke "N" glyph painted inline in `index.html` before JS loads,
   strokes CONVERGING diagonally on startup (~700ms), always in the full
   accent color. Dismissal fades in place when signed in; when signed out
   the assembled logo glides and zooms into the sign-in card's glyph.
3. Timeline view only. No tree/kanban/calendar views.

## Nostr semantics

- Kinds: 0 metadata, 1 message, 5 deletion, 1621 task, 1630–1633 task states
  (1631 done, 1632 closed, 1630/1633 open — or "active" when the state
  event's content is non-empty; the content doubles as a custom status
  label, e.g. "Review"), 30177 shared topics (see below).
- **Channels are hashtags**: a post's channels = `t` tags ∪ in-content
  `#hashtags`, lowercased; color tokens — UPPERCASE hex or digit-only
  runs of length 3/4/6/8 (#FEE, #123) — are not hashtags, lowercase #fee
  is. No NIP-28. **Spaces are relays**; empty space selection = "All
  spaces", never "no relays".
- **Replies** link via `e` tag with marker `parent` (preferred) or `reply`.
- **Publishing**: a post MUST carry ≥1 channel (written as lowercased `t`
  tags). New posts target exactly ONE relay: the active space, else the sole
  connected relay, else a readable error. Replies pin to the parent's origin
  relay (first of its relays). Kind-0 profiles publish to ALL session relays
  (or one relay for per-space profiles).
- **Deletions** (kind 5): tombstone only the author's own events; deleted
  ids never resurrect on re-ingest.
- **State folding**: 1630–1633 reference the task via `e` tag; fold into the
  task's `stateUpdates` newest-first (dedupe by event id); buffer folds that
  arrive before their target (capped) and replay on landing. State events
  render as compact timeline rows, never as post cards.
- **Topics** (kind 30177, addressable — full spec `docs/nip-topics.md`):
  identified by their CHANNEL SET, not their name — `d` = canonical
  encoding of the set (deduped lowercase channels, sorted, `+`-joined);
  `title` tag carries the display name; first `t` tag = primary channel
  (navigation hint, not identity), rest secondary. Relay-communal: newest
  `created_at` per channel set wins ACROSS authors (derive identity from
  the `t` tags, not `d`). NIP-09 deletion for own definitions.

## Noas auth

1. Discovery: `GET https://<host>/.well-known/nostr.json` → `noas.api_base`
   (absolute or origin-relative); fallback `https://<host>/api/v1`. The `noas`
   object MAY also carry `relays` (an array of the tenant's domain-default
   space URLs) and `email_verification_mode`; both may be absent.
2. Sign-in: `POST <api_base>/auth/signin` with
   `{username, password_hash: sha256-hex(password)}`. Accept field aliases
   (`encryptedPrivateKey` / `encrypted_private_key` /
   `private_key_encrypted`; `publicKey` / `public_key` / `public_npub`,
   npub or hex; top-level or under `user`). 401 → invalid credentials,
   403 → disabled/unverified (surface server message).
3. Decrypt the `ncryptsec` locally with the RAW password (NIP-49); also
   accept raw 64-hex or `nsec`. Verify derived pubkey against the response
   (mismatch = error). Persist session in localStorage (pubkey, private key
   hex, username, apiBase, relayUrls); reject malformed entries, never
   migrate. Profile picture URL: `<api_base>/picture/<pubkeyHex>`.
4. Registration: use the provided/mined key or generate one on-device,
   NIP-49-encrypt with the password, `POST /auth/register` `{username,
   password_hash, public_key, private_key_encrypted, redirect: origin,
   email?}`; then attempt sign-in, surfacing the server's verification
   message if it fails.
5. There is NO server field: `user@domain` usernames pick the host, plain
   usernames use the deployment default. Zero configured relays is a valid
   sign-in.
6. Space auto-detection ladder (run during sign-in, before onboarding): use
   the sign-in response `relays`; else the discovery `noas.relays`; else probe
   `wss://<sub>.<root-domain-of-the-noas-host>` for each configured subdomain
   (default `tasks, feed, relay, nostr`, overridable per deployment) and adopt
   the first that is reachable — a WebSocket that opens. Candidate derivation
   is `spec/vectors/space-detection.json`; the reachability probe is
   client-local. Only when every rung comes up empty does onboarding ask for a
   space. Subdomain probing is skipped for localhost/IP hosts.

## Subscriptions

Separate filters and subscriptions per concern — profiles must not queue
behind the content backfill:

- Profile subscription (opened first): kind 0 (limit 500), kind 30177
  (limit 200).
- Content subscription: kinds 1+1621 (limit 1000), kinds 5+1630–1633
  (limit 1000). Its EOSE ends "hydrating" and triggers a targeted
  `fetchEvents` for kind-0s of any post author/mention still missing.
- Publishes echo optimistically through the ingest path attributed to the
  target relays (disable NDK's own optimistic dispatch).
- Own kind-0 is fetched one-shot before profile editing; edits merge into
  the fetched content so unknown fields (lud16, banner…) survive; cleared
  fields are removed. Merge bases tracked per scope ("*" or relay id).

## Color scheme (design tokens)

Light: background #FAFAFC, surface #FFFFFF, text #131315, muted text
#6E6E73, main accent #4785FF (buttons/CTAs), muted accent #C7D9FF
(tags/chips), accent contrast white. Dark: the main background is FULL
BLACK #000000 (OLED-friendly — deliberate deviation from the sheet's
#131315, which becomes the elevated-surface color instead), text #FFFFFF,
and the accents are the light values composited at 57% opacity over
#131315. A separate `--brand` token keeps the logo at full #4785FF in BOTH
modes — the glyph never dims. Known deviation: dark muted text is #8B8B90
(the sheet's #6E6E73 fails contrast on pure black). Favicon/app icons: the
two-stroke N glyph, #4785FF on black.

## Screens and behavior

- **Sign-in card**: glyph (the splash logo glides into it when signed
  out), tabs Sign in / Create account; NO server field — a user@domain
  username picks the host, plain usernames use the deployment default
  (VITE_NOAS_HOST_URL, fallback nodex.nexus), with a hint naming the
  effective host. Password min 8 on register. Email appears only when the
  discovered host's email_verification_mode is "required" (re-discovered
  as the username changes). Optional private key field: 64-hex/nsec with
  live npub preview, plus vanity mining — npub prefix from the username's
  first ≤3 bech32 letters, run in a worker; auto-mine after 500ms once the
  local part has ≥4 chars and the field is empty, impatient re-click drops
  to a 2-char prefix, never overwrite typed input.
- **Onboarding** (first sign-in per device, per pubkey, in localStorage):
  optional "connect your space" step ONLY when the space-detection ladder
  (§ Noas auth 6) found nothing → welcome ("Hey {name}…") → profile (picture
  URL with live avatar preview, display name, bio, website — prefilled from
  the fetched kind-0) → channel picks (live channels with counts) which become
  **pinned channels**, pinned per space via the content-at-pin-time rule.
- **Timeline screen**:
  - Mobile top bar: hamburger (menu sheet: user + edit profile + sign-out,
    space selector, per-relay status, add-space, language) + chips row.
  - Desktop ≥900px: persistent sidebar (brand, space selector, relay list
    with status dots, add-space, channel list with nested topics, user card,
    language) replaces the top bar; grid `minmax(15rem,18rem) 1fr`,
    full-bleed column, NO max-width caps, seamless backgrounds (transparent
    feed over the body background — no edge borders at any width).
  - Chips row order: pinned topics, then channels (pinned first, with post
    counts and pin icons); after any INCLUDED channel chip, all topics
    containing that channel (deduped). "+" chip last creates a topic.
  - **Chat orientation**: oldest at top, newest at bottom; auto-scroll
    pinned to the newest message unless the user scrolled up; pinning
    survives hydration bursts and resizes (ResizeObserver). Recycler-style
    window: render only the newest ~80 items, reveal older incrementally on
    scroll-up with the viewport anchored; appended items grow the window
    while reading history.
  - **Cards**: status icon gutter for tasks (open ○ / active ⊙ orange /
    done ✓ blue / closed ⊘, strikethrough content when finished), avatar +
    author (profile hover cards on names, avatars, @mention chips: picture,
    names, nip05, bio, website, short npub; hover on desktop, tap on touch),
    clickable channel chips, timestamp right (localized: time today,
    "yesterday HH:MM", month+day within ~10 months, short date beyond),
    linkified URLs, hashtag styling, 4-line clamp with show-more, reply
    indicator, attribution dots.
  - **Breadcrumbs**: reply cards show the ancestor chain (root › … ›
    parent, ≤3); clicking a crumb / reply indicator / state row focuses the
    THREAD (root + all descendants, channel scope bypassed; relay scope and
    search still apply) with a dismissible thread bar.
  - **Compact state rows**: status icon, label (state content or translated
    status name), author, task content one-line, time.
- **Filtering model**: channel chip tap = exclusive include (tap the sole
  included channel to clear); long-press (or right-click) any channel chip
  or sidebar entry pins/unpins. Pins are PER-SPACE (spec vector
  pinning.json): pinning applies to the scoped spaces that have content in
  the channel at pin time (whole scope as fallback), unpinning removes the
  scoped spaces; pinned display and default scope resolve against the
  current space selection (persisted per account as channel → relay ids).
  Excludes supported in the model. With NO explicit includes, the default
  scope = pinned channels ∪ posts mentioning me ∪ my own posts (everything
  when nothing is pinned). Topics: selecting one includes all its tags; selecting a topic
  with no channel included auto-selects its primary channel; **tapping a
  channel clears selected topics (switch over, never stack)** — topic on
  top of an already-selected channel composes. Topic pinned state is
  per-user.
- **Unified bottom bar** (search + composer in one): always visible; typed
  text live-filters the feed (case-insensitive substring; state rows also
  match their label); typed `#hashtags` scope the feed AND become the
  post's channels; the send button appears once the draft carries ≥1
  channel (chip, topic, or typed). Enter sends when possible; Escape
  clears.
- **Topic manager sheet**: create (name, primary channel select, secondary
  channel toggles, free-text tag input — prefilled from current context,
  auto-pins on create) and manage (pin/unpin; delete only for own topics).
- **Profile sheet** (menu / sidebar user card, any time): scope selector
  (All spaces or one space = separate per-space kind-0), same fields as
  onboarding.

## Internationalization

Full i18n with English and German. Rune locale store: auto-detect from
`navigator.language`, persisted override, switcher in menu sheet and
sidebar. ALL UI strings via `t(key, params)`; timestamps localize via Intl.
Domain/store errors throw stable `error.*` message KEYS translated at render
time; unknown keys (raw server messages) pass through verbatim. Keep
"Channels", "Spaces", "Thread" as product terms in German.

## Testing and conventions

Vitest, node environment, behavior over implementation. Cover at minimum:
attribution union-merge (incl. folded-state preservation on re-ingest),
tombstones, pending-fold replay, channel AND-filtering, thread collection,
pinned-scope defaults, search, publish rules (single-relay resolution, reply
pinning, channel requirement), draft channel derivation, hashtag/hex-color
parsing, content tokenizing, relay identity (normalize/id/name/color slot),
timestamp buckets, noas parsing (aliases, 401/403, key mismatch) and a real
NIP-49 round-trip, user@domain splitting, profile content merging, topic
event build/parse round-trip, topic toggle auto-select and channel
switch-over. Conventions: Conventional Commits with explicit file lists;
reject-don't-migrate localStorage; `// why:` comments on every `$effect`;
no `aria-*` (visual-only; `data-testid` as last resort); `svelte-check` and
the build must be clean.
