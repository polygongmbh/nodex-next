# Development history

How nodex-next came to be, in order, with the reasoning that drove each
step. Companion documents: [rebuild-prompt.md](./rebuild-prompt.md) (build
this again from scratch), [mobile-app-prompt.md](./mobile-app-prompt.md)
(native companion app), [nodex-parity.md](./nodex-parity.md) (what's
faithful, missing, or out of scope), [nip-topics.md](./nip-topics.md) and
[nostr-extensions.md](./nostr-extensions.md) (protocol).

## Origin and inputs

The rewrite started from three documents:

- `../nodex/nodex.md` — product vision (context-first, tag-based information
  model, replaceability).
- `../nodex/nodex-talk.md` — the strategic narrowing: strip everything to the
  mobile Timeline (team messaging) for the first external customers.
- `../nodex-talk/SPEC.md` — a consolidated build spec originally written for
  a Flutter spinoff, which nailed down the semantics this rewrite ports:
  per-relay attribution, noas auth flow, kinds, publish rules.

Hard requirements carried over unchanged: **per-relay event attribution is
essential**, and **noas sign-in is the entry dialogue** right after the
splash animation.

## Phase 1 — Ground-up scaffold (framework decision)

- **Svelte 5 (runes) + Vite + TypeScript**, replacing React. Rationale: the
  original's hardest bugs lived in React plumbing (external-store snapshots,
  batching, memo chains); rune stores made the entire notification machinery
  disappear. Domain stays plain TS.
- **No Tailwind**: scoped component styles + one token sheet (`src/app.css`).
- **No router**: splash → sign-in → timeline is a state machine, not routes.
- **NDK v3** for pool/signing/subscriptions only. Event state lives in our
  stores because NDK's cache dedupes by id and loses the delivering relay.
  Attribution = listen to `event` AND `event:dup`, union relay ids per post
  (the JS equivalent of SPEC.md's per-relay-subscription strategy for dart).
- Layers: `domain/` (pure, dependency-free — the invariant spec, fully
  tested), `infrastructure/` (noas + NDK), `stores/` (rune classes,
  controllers expose commands only), `components/`.
- Splash: the two-stroke "N" glyph painted inline in `index.html` before JS.

## Phase 2 — Feature parity push

- **Backfill fix**: one mixed-kind filter let kind-0/state events starve the
  message limit; filters split per concern.
- **user@domain sign-in** (server field optional), later + registration.
- **Onboarding**: welcome → profile → channel picks (pinned channels become
  the default feed scope together with mentions).
- **Comprehensive timeline**: reply cards with parent context, compact rows
  for task state updates, status icons/strikethrough, mention + channel
  chips, linkified content with show-more, chip counts.
- **Unified bottom bar** (the nodex mobile concept): one input that
  live-searches the feed, whose typed #hashtags scope the feed AND become
  the post's channels; send appears once a channel is in context.

## Phase 3 — Interactivity and desktop

- **Thread focus**: breadcrumb ancestor chains on cards, reply indicators
  and state rows all focus the conversation (ancestors + descendants,
  bypassing channel scope) with a dismissible thread bar.
- **Profile hover cards** on names/avatars/mentions.
- **Desktop ≥900px**: persistent sidebar (spaces, channels, user), sharing
  all stores with the mobile chips row.
- **Profile setup done right**: fetch the existing kind-0 before editing,
  merge edits into it so unknown fields (lud16, banner) survive republish.

## Phase 4 — Chat feel and scale

- **Feed flipped** to chat orientation (newest at bottom) with scroll
  pinning; later hardened with a ResizeObserver and **recycler-style
  windowing** (newest ~80 items render; older revealed incrementally with
  anchored scroll).
- **Profiles prioritized**: own subscription whose REQ precedes the content
  backfill + targeted post-EOSE fetch for authors still missing.
- **Full-bleed responsive layout**, seamless backgrounds, no width caps.
- **i18n (en/de)**: rune locale store; domain/store errors throw stable
  `error.*` keys resolved via `t()` at render time so raw server messages
  pass through.
- **Per-space profiles**: scope selector in the profile editor; a space can
  carry its own kind-0.
- **Spaces management**: sign-in works with zero relays (onboarding then
  asks for a space first); add-space input everywhere.

## Phase 5 — Topics

Went through three shapes, converging on the sketch (nodex brainstorm p.21):

1. Local named tag-sets in preferences.
2. Primary + secondary channels; nested under channels; auto-select primary.
3. **Shared relay events** (addressable kind 30177, drafted as a NIP):
   relay-communal namespace (newest per `d` wins across authors), pinned
   state kept personal, topics unfold under any of their selected channels,
   channel taps switch over from topics instead of stacking.

## Working conventions that shaped the code

- localStorage entries are rejected when malformed, never migrated.
- Commit per self-contained change with explicit file lists.
- `svelte-check` and vitest must be clean before finishing; behavior tests
  over implementation detail; no `aria-*` (visual-only app).
- New `$effect`s carry a `// why:` comment.
