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
  `localStorage` (web equivalent of "trust this browser").
- **Channels are hashtags** (no NIP-28); **spaces are relays**; empty space
  selection means "All spaces", never "no relays". Channel filters are AND.
- **Publishing** requires ≥1 channel (included chip or typed `#hashtag`,
  written as lowercased `t`-tags) and targets exactly one relay: the active
  space, else the sole connected relay, else a readable error. The composer
  input hides behind a "Pick a #channel to post" hint until a channel is
  included or the draft carries a hashtag.
- **Deletions** (kind 5) tombstone only the author's own events; state events
  1630–1633 fold into their task and never render as timeline entries.

## Deviations from SPEC.md

- SPEC.md targets Flutter/Riverpod; this is the web/Svelte port of the same
  contracts (provider shapes became rune stores with the same semantics).
- Attribution uses one subscription + `event:dup` instead of one subscription
  per relay — the dart-ndk dedup limitation does not apply to JS NDK.
- Replies: the timeline shows reply counts; a thread view and reply composing
  (pinned to the parent's origin relay — the rule is implemented and tested in
  `publish-rules.ts`) are not wired into the UI yet.
