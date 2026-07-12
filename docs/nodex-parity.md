# Nodex parity — what's here, what needs work, what's missing, what's out of scope

Honest inventory of nodex-next against the original nodex (`../nodex`),
grouped by status. "Faithful" means behavior-compatible, not line-ported.

## Faithfully present

- **Per-relay attribution** end to end: union-merge ingest, attribution
  dots, delivery sheet, relay-scoped feed filtering, replies pinned to the
  parent's origin relay. Same rationale as nodex (NDK event cache disabled).
- **Noas auth**: discovery, sign-in with password hashing and field
  aliases, local NIP-49 decrypt, pubkey verification, persisted session,
  registration with on-device key generation, picture endpoint.
- **Channels-as-hashtags / spaces-as-relays** including "All spaces ≠ no
  relays", AND filter semantics, exclusive chip include, excludes.
- **Publish rules**: ≥1 channel, single-relay targeting, readable errors.
- **Task display semantics**: kinds 1621/1630–1633, newest-first state
  folding with pending-fold buffering, content-as-status-label
  ("Review"), status icons, strikethrough, compact state rows — wire-
  compatible with nodex/mostr.
- **Deletions** (NIP-09, own-author tombstones).
- **Splash** (same glyph, same choreography) → sign-in as entry dialogue.
- **Unified mobile bottom bar** (search + context + composition in one) —
  arguably more faithful to the nodex-talk intent than nodex itself.
- **Profile editing** with kind-0 fetch-then-merge (unknown fields
  survive), plus per-space profiles — which nodex does not have yet.
- **Onboarding flow** per nodex-talk.md (welcome, profile, channel picks).
- **Topics** per the brainstorm sketch, upgraded to shared relay events
  (kind 30177) with a NIP draft — beyond nodex, which has no topics yet.
- **Thread participation**: focusing a thread (breadcrumbs, reply counts,
  post-menu Reply) turns the bar into a reply composer with inherited parent
  channels and origin-relay pinning. Replies under a kind-1 root are NIP-10
  kind-1; under any other root (tasks, calendar events) they are NIP-22
  kind-1111 comments.
- **Post context menu** (tap a card — posts AND calendar events): a small
  inline popup anchored at the tap point (quick-emoji row + action row,
  scale-in, no dimmed backdrop, clamped/flipped at viewport edges) offering
  reply, NIP-25 reactions (quick-emoji registry, +/- normalization, kind-5
  toggle, count chips on post and calendar cards, `k` = target kind),
  permalink copy, and for own items recompose (replace-then-delete, kinds 1
  and 1111 — not calendar events) and NIP-09 delete (own calendar events add
  the addressable `a` coordinate) — all publishing to the relays that
  delivered the target.
- **Shared-link resolution**: opening `origin/relayHost/eventId` on boot
  focuses the thread and cleans the path (replaceState); an unknown relay host
  is added as a space. The thread back bar renders even before the target has
  loaded, so a deep link is never a trap.

## Present but needs work

- **History depth**: backfill is limit-based only; no `until` paging when
  the user scrolls past the oldest loaded message.
- **Search**: content substring only; nodex also matches authors and richer
  query syntax.
- **Per-space profile display**: editing is per-space, but rendering still
  uses one global newest kind-0 per pubkey (nodex keeps per-relay kind-0
  stores). Needs per-relay people maps keyed by origin.
- **Space management**: adding a space restarts the relay service (filters
  reset); no removal, reordering, or NIP-11 info; no relay health UI beyond
  connected/offline.
- **Relay auth**: nodex handles NIP-42 challenges (incl. retry policy);
  nodex-next has none — auth-required relays will not deliver.
- **Failed publishes**: nodex persists drafts and retries; here a failure
  is only an inline error.
- **Hover popovers** (profile cards) don't flip at viewport edges — unlike the
  post-menu popup, which now clamps and flips; long feeds have no date
  separators; topic kind 30177 is provisional pending upstream discussion.

## Missing (belongs in this app eventually)

- Presence (NIP-38 kind 30315, relay-scoped) and the people/sidebar
  presence UI; mention autocomplete in the composer.
- Attachments and media: imeta on publish (a deliberate nodex contract),
  inline image rendering, calendar-event attachments (nodex-talk names
  events as a core messaging differentiator).
- Offline/persisted event cache with attribution (nodex: localStorage
  posts cache rebuilt by the live subscription).
- Mentions-of-me notification surface; unread markers.
- NIP-78 sync for preferences/pinned/topics-pinned across devices.

## Deliberately omitted / out of scope for now

- **New mobile UX investment**: the responsive mobile layout stays
  functional as the link-opening fallback (frozen, fixes only); the
  polished phone experience is nodex-talk's job (see
  [mobile-app-prompt.md](./mobile-app-prompt.md) "Platform split"). This
  app's design focus is web + desktop.

- **All non-timeline views**: tree, kanban, calendar, status, home — the
  entire point of this rewrite (nodex-talk.md) is one excellent Timeline.
- **Task creation and state changes**: tasks render faithfully but are
  read-only; task management stays in nodex/mostr until the messaging core
  is proven. (Task attachments to messages are the intended future path.)
- **Priorities, dates, assignment chains, saved filters, quick filters,
  focused-task context model** beyond thread focus.
- **NIP-07 / NIP-46 signers and raw-key login**: noas is intentionally the
  only auth path here — it IS the product's entry experience. (nsec import
  exists only implicitly via noas responses.)
- **NIP-28 channels**: rejected by design; channels are hashtags.
- **Accessibility (aria) work**: excluded by explicit project policy
  (visual-only application).
- **Multiple simultaneous accounts**, kiosk/public mode, integrations
  (Apple Reminders, CalDAV bridge) — ecosystem projects, not this client.
