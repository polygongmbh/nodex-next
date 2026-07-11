# Nodex Next

Ground-up rewrite of [Nodex](../nodex) focused on the **mobile Timeline
experience** (team messaging), per `../nodex/nodex-talk.md` and the
consolidated build spec in `../nodex-talk/SPEC.md`.

```sh
npm run dev     # dev server on port 8081
npm run build   # production build
npm run check   # svelte-check typechecking
npm run test    # vitest
```

## Documentation

- [docs/development-history.md](docs/development-history.md) — how this got built, phase by phase
- [docs/rebuild-prompt.md](docs/rebuild-prompt.md) — self-contained prompt to rebuild this app from scratch
- [docs/mobile-app-prompt.md](docs/mobile-app-prompt.md) — prompt for the native mobile companion (supersedes nodex-talk/SPEC.md)
- [docs/nodex-parity.md](docs/nodex-parity.md) — faithful / needs work / missing / out of scope vs. nodex
- [docs/nip-topics.md](docs/nip-topics.md) — NIP draft for shared topics (kind 30177)
- [docs/nostr-extensions.md](docs/nostr-extensions.md) — survey of all protocol conventions in use
- [spec/README.md](spec/README.md) — cross-client test vectors (shared with the mobile client); behavior changes land there first

## Framework decisions (vs. the React/Tailwind original)

- **Svelte 5 (runes) + Vite** instead of React. Domain logic stays in plain
  TypeScript classes/functions; reactivity is compiler-driven, so there is no
  provider tree, no `useSyncExternalStore` plumbing, and no memo discipline.
  Bundle: ~146 kB gzip, dominated by NDK/crypto, not the framework.
- **No Tailwind.** Svelte's scoped component styles plus one small token sheet
  (`src/app.css`) replace it. Mobile-first: single-column layouts, safe-area
  insets, `100dvh`, bottom-sheet interactions.
- **No router.** The app is one screen behind an auth gate: splash → noas
  sign-in → timeline.

## NDK usage and the attribution caveat

NDK (`@nostr-dev-kit/ndk`) is used for what it is good at — relay pool,
signing, subscription lifecycle — but **event state lives in our own stores**
(`src/stores/timeline.svelte.ts`), because per-relay event attribution is
essential and NDK's cache dedupes by event id, losing which relays delivered
an event. Attribution strategy (JS equivalent of SPEC.md's per-relay
subscriptions): listen to both `event` (first delivery) and `event:dup`
(same event from another relay) and union relay ids per post. NDK's event
cache stays disabled; `autoConnectUserRelays` and the outbox model are off.

## Layers

- `src/domain/` — pure, dependency-free TypeScript: `Post`/`Person`/`Channel`,
  kind registry (0, 1, 5, 1621, 1630–1633), event classification, hashtag ∪
  t-tag channel derivation, relay identity (id / display name / color slot),
  publish rules, timestamp format. This is the invariant spec; it is fully
  unit-tested and event-compatible with nodex/mostr on the same relay.
- `src/infrastructure/` — noas (discovery → signin → local NIP-49 decrypt →
  pubkey verify → session persistence) and the NDK service.
- `src/stores/` — Svelte 5 rune stores: `auth`, `timeline` (ingest with
  union-merge, tombstones, pending state folds), `filters` (channel chip
  states + space selection), and a `timeline-controller` exposing commands
  only.
- `src/components/` — sign-in screen, timeline screen, cards with relay
  attribution dots → bottom sheet, channel chips, space selector, composer.

## Behavior notes

- **Noas sign-in is the entry dialogue** right after the splash (the same
  two-stroke "N" glyph animation as nodex, ≥450 ms, painted from `index.html`
  before JS loads). It is the only auth path; the decrypted key persists in
  `localStorage` (web equivalent of "trust this browser"). There is no
  server field: `user@domain` picks the host, plain usernames use the
  deployment default host. Registration adapts to the discovered host and
  offers full key handling (paste hex/nsec with npub preview, or vanity-mine
  a key from the username's initials).
- **Space auto-detection** runs during sign-in so onboarding rarely has to
  ask: the account's own relays win, else the tenant defaults noas advertises
  at discovery (`noas.relays`), else a WebSocket probe of
  `wss://<subdomain>.<root-domain-of-the-noas-host>` (default subdomains
  `tasks, feed, relay, nostr`, `VITE_SPACE_PROBE_SUBDOMAINS` to override) that
  adopts the first reachable one. Only when all three come up empty does the
  optional "connect your space" step appear.
- **Onboarding** runs after the first sign-in on a device: (space →) profile →
  channel picks (→ PWA). It is also skipped automatically when the relay
  already has a kind-0 profile for the account, so signing in on a new
  device/browser for an already-set-up account goes straight to the timeline.
  There is no standalone welcome screen — the greeting
  is the profile step's heading. The profile step leads with a photo **upload**
  straight to noas (the account's only media endpoint; an image-URL field sits
  behind a disclosure), then display name (defaulting to the capitalized
  username) and bio; website is not asked here (it stays in the full editor).
  It fetches your existing kind-0 and publishes edits merged into that base
  (unknown fields like `lud16` survive). Picked channels are pinned: they lead
  the chips row and form the default feed scope together with posts that
  mention you. On a mobile browser (and not already installed) a final PWA step
  shows the OS's own install steps — share sheet on iOS, browser menu on
  Android, worded browser-neutrally so Firefox/Brave users aren't misdirected;
  the app ships a web manifest and icons so it installs standalone.
- **Re-running onboarding** (dev/test): visiting `/onboarding` while signed in
  forces the flow again in-memory only — stored data is left untouched unless
  you complete it again, and the URL stays put so a refresh keeps re-forcing it.
- **Editing your profile** later uses the same avatar upload; picture uploads
  need a fresh sign-in (noas authenticates them with the password hash, kept
  with the session), otherwise the image-URL field is offered instead.
- **Desktop (≥900px)** gets a persistent sidebar — spaces with connection
  dots, vertical channel list, user card — while phones keep the hamburger
  and chips row.
- **Interactivity**: reply cards carry clickable breadcrumb ancestor chains;
  crumbs, reply indicators, and state rows focus the conversation scoped to
  the clicked post (its ancestors + its own replies) — focusing a nested reply
  stays within its subtree and drops sibling branches. While a thread is open
  the nav row
  (hamburger / space / channels) is replaced by a full-width back bar — tap
  anywhere on it to exit. Names, avatars, and @mentions open profile hover
  cards; card channel chips filter on click.
- **Post context menu**: tapping a card body (not an inner control, and not
  while selecting text) opens a compact menu for that post — a bottom sheet on
  phones, a small centered card on desktop. **Reply** focuses the post's thread
  (turning the bottom bar into a reply composer — this is how reply-less posts
  become repliable). **Copy link** copies the post's permalink
  (`origin/relayHost/eventId`, the relay host omitted when unknown) and shows a
  brief "Link copied" confirmation.
- **Reactions** (NIP-25, kind 7): the menu offers a quick-emoji row
  (👍 ❤️ 🎉 😄 🚀 👀 🙏 🙌 🛠️ 👎 — the original nodex registry); the thumbs
  normalize to `+`/`-` on the wire, other emojis pass through verbatim. A
  post's reactions render as compact count chips under its content (own
  reaction highlighted); tapping a chip toggles/switches yours. Reactions
  publish to every connected relay that delivered the post (per-relay
  attribution); re-reacting with the same emoji deletes your prior reaction
  (kind 5), a different emoji replaces it (newest-wins).
- **Channels are hashtags** (no NIP-28); **spaces are relays**; empty space
  selection means "All spaces", never "no relays". Channel filters are AND.
- **Topics** are named, composable tag combinations (not sub-channels), each
  with a primary channel and secondary channels. They are **shared**: each
  topic is an addressable kind-30177 event on the relay (spec:
  `docs/nip-topics.md`), visible to every user of the space; the newest
  definition per channel set wins across authors (a topic is identified by the channels it contains, not its name), and NIP-09 deletion removes your
  own. Selecting a topic scopes the feed to ALL its tags, drops any conflicting
  channel include, and hides channels the topic doesn't tag; the topic unfolds
  under every one of its channels (primary or auxiliary) that is active. The
  primary channel decides where it lives in the sidebar. Selecting a channel
  switches over from a selected topic rather than stacking, and a channel only
  toggles off on a second tap when it is the sole active thing. Pinned state is personal, stored per
  account in localStorage next to pinned channels. All other protocol
  conventions are surveyed in `docs/nostr-extensions.md`.
- **Chat orientation**: newest messages at the bottom with auto-scroll;
  long-press any channel chip to pin it — pins are per-space (the selected
  spaces with content in the channel at pin time). The feed renders a window over the
  newest ~80 items ("show older" appears on scroll-up), and the hydration
  backfill applies in coarse batches — a fast first paint, then ~2 updates/s
  until EOSE — so scrolling stays steady while history streams in. The sign-in card also offers
  account creation (key generated or mined on-device, NIP-49-encrypted).
  UI in English and German (`src/lib/i18n`).
- **Profiles** stream on a dedicated subscription before the content
  backfill, with a targeted post-EOSE fetch for stragglers; "Edit profile"
  works per space (a separate kind-0 per relay) or across all spaces. Opening
  the editor is cache-first: the live subscription primes the kind-0 merge
  base, so it usually needs no network fetch (the fetch stays as the
  cold-start/miss fallback), and an empty or timed-out fetch is never cached —
  a real profile is never overwritten with a blank.
- **The timeline** shows post cards (replies carry a parent-context header
  and count toward the parent's reply indicator) and compact rows for task
  state updates; tasks get a status icon and strikethrough when finished.
- **The bottom bar is search and composer in one**: typed text live-filters
  the feed even with no channel selected, typed `#hashtags` scope the feed
  and become the post's channels, and the send button appears once the
  draft carries a channel.
- **Publishing** requires ≥1 channel (included chip or typed `#hashtag`,
  written as lowercased `t`-tags) and targets exactly one relay: the active
  space, else the sole connected relay, else the single space that carries
  the draft's channels. Only when the channels span several spaces does the
  bar show a space picker and require you to pick one first.
- **Attach a calendar event** (📅 in the bar) to post a NIP-52 event (kind
  31922 all-day / 31923 timed) instead of a plain message: fill in title,
  start (and time/end/location), and send — it carries the draft's channels
  and targets the resolved space, then renders as a calendar card. This is
  the "post an event → calendar sync" path.
- **Deletions** (kind 5) tombstone only the author's own events; state events
  1630–1633 fold into their task and render only as compact rows, never as
  post cards.

## Deviations from SPEC.md

- SPEC.md targets Flutter/Riverpod; this is the web/Svelte port of the same
  contracts (provider shapes became rune stores with the same semantics).
- Attribution uses one subscription + `event:dup` instead of one subscription
  per relay — the dart-ndk dedup limitation does not apply to JS NDK.
- Replies: focusing a thread (reply indicator / breadcrumb / state row) turns
  the composer into a reply — it carries proper NIP-10 threading tags (a
  `root`-marked `e`-tag for a top-level reply, `root` + `reply` for a nested
  one, plus participant `p`-tags), inherits the parent's channels, and pins to
  the parent's origin relay. Incoming replies link by NIP-10 `reply`/`root`
  markers (and the legacy `parent` marker for nodex/mostr compatibility).
