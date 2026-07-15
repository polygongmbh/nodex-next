# Build prompt — Nodex companion mobile app (native)

A self-contained prompt for a NATIVE mobile companion to nodex-next
(`~/IT/nostr/nodex-next`, Svelte web). It supersedes the earlier
`~/IT/nostr/nodex-talk/SPEC.md`: same product, updated to everything the
web app now does. Where behavior is specified in detail, defer to
[rebuild-prompt.md](./rebuild-prompt.md) — the two clients MUST be
indistinguishable on the wire.

---

Build **Nodex Talk**: a native mobile app (Flutter + the dart `ndk` package,
state via flutter_riverpod — or an equivalent native stack) for the Nodex
Timeline. One view: the chat-oriented timeline. It shares relays, event
kinds, and conventions with nodex-next and mostr.

## Wire compatibility (non-negotiable)

Every wire/protocol fact is normative in [protocol.md](./protocol.md);
implement it exactly, alongside rebuild-prompt.md §"Noas auth" and
§"Subscriptions".
The two clients MUST be indistinguishable on the wire.

- All kinds, channel rules, reply markers (`parent` preferred), publish
  targets, deletion, state-fold, reactions, and topic rules per
  [protocol.md](./protocol.md) — the shared spec vectors are the enforcement
  gate.
- **Per-relay attribution** ([protocol.md §Per-relay attribution](./protocol.md#per-relay-attribution--client-behavior-no-nip-needed)).
  Caveat specific to dart ndk: its
  `StreamResponseCleaner` dedupes events by id across relays (first relay
  wins) and its cache overwrites instead of unioning. Therefore open ONE
  subscription PER RELAY (`explicitRelays: [thatRelayUrl]`) and union
  attribution in your own posts store; map URLs to relay ids first. Do not
  use the ndk cache for events.
- Profiles and topics on their own per-relay subscriptions opened before
  the content backfill; missing-author kind-0 backfill after EOSE.
- Noas: discovery → signin (sha256 password_hash, field aliases) → local
  NIP-49 decrypt (package `nip49`) → pubkey verification → session in
  `flutter_secure_storage` (the secure-enclave equivalent of the web's
  "trust this browser") → registration with on-device key generation.
  `user@domain` fills the server; zero relays is a valid session.

## Mobile-native experience (where this app should be BETTER than the web)

- Splash: the two-stroke "N" glyph animation (≥450 ms) → noas sign-in →
  (space step if no relays) → onboarding (welcome, profile prefilled from
  the fetched kind-0 with merge-on-publish, channel picks → pinned).
- Timeline as a real chat list: newest at bottom, `ListView` with builder
  recycling (this is native — no windowing workarounds), scroll pinned to
  the newest message unless reading history, date separators, pull-down at
  the top to reveal older items.
- Unified bottom bar (search + composer in one) with the same channel/topic
  scoping rules; native keyboard handling and safe areas.
- Chips row with pinned topics/channels, topics unfolding under any
  selected channel, long-press (native) to pin/unpin or manage topics,
  switch-over semantics on channel taps.
- Cards: status gutters, breadcrumbs → thread focus, profile sheets
  (long-press or tap on avatar/name/mention — hover does not exist),
  attribution dots → bottom sheet, localized timestamps.
- Per-space profile editing; add-space; language follows the system locale
  (en/de, same key set as the web app — port `src/lib/i18n/*.ts`).
- Native additions the web cannot do (in scope): push-style local
  notifications for mentions while the app runs; share-sheet target that
  pre-fills the composer; haptics on long-press.

## Architecture

- `lib/domain/` mirrors `src/domain/` of nodex-next one-to-one (pure Dart,
  no ndk imports): post/person/channel/topic models, event classification,
  hashtag + content tokenizing, relay identity (id/name/color slot), publish
  rules, timestamp formatting, profile merging, topic event build/parse.
  **Consume the shared spec vectors** (`nodex-next/spec/vectors/*.json`,
  contract in `spec/README.md`) via a thin `flutter test` adapter mirroring
  nodex-next's `src/test/vectors-*.test.ts` — that suite, not prose, is the
  wire-compatibility gate.
- `lib/application/`: riverpod Notifiers — auth controller
  (restoring/signedOut/signedIn), timeline controller (start/stop/restart,
  sendMessage, createTopic/deleteTopic, fetchOwnProfile/publishProfile with
  per-scope merge bases), filter store (channel states, active relay,
  selected topics, thread focus), preferences (onboarded, pinned channels +
  topics, per pubkey).
- `lib/infrastructure/`: noas client + per-relay ndk service.
- `lib/ui/`: one widget per file, ~300-line cap, no golden tests for
  complex screens.

## Platform split (division of labor with nodex-next)

Two genuinely different applications, one behavior spec:

- **nodex-talk (this app) owns the phone experience** — gestures, native
  scrolling, haptics, notifications, share sheet. Do not build tablet/desktop
  layouts here.
- **nodex-next owns web and desktop** — sidebar layout, density, hover,
  keyboard. Its mobile layout is FROZEN as a functional fallback (shared
  links inevitably open in mobile browsers), receiving fixes but no new
  mobile UX investment; polished phone UX lives here.
- The shared spec vectors (`nodex-next/spec/`) are the sync mechanism:
  behavior changes land there first, then in both clients. UI divergence is
  expected and healthy; wire/behavior divergence is a bug.

## Out of scope (same as the web app)

Tree/kanban/calendar/status views, task creation and state changes,
reactions, attachments, offline event cache, NIP-07/46 signers. Read
[nodex-parity.md](./nodex-parity.md) before expanding scope.
