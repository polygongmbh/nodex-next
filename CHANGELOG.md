# Changelog

## [Unreleased]

### Changed

- **WIRE CHANGE — replies to non-kind-1 posts are now NIP-22 kind-1111
  comments** (previously kind-1 with parent markers). Replying to a task or a
  calendar event publishes a kind-1111 comment carrying the root scope as
  `A`/`E` + `K` + `P` and the immediate parent as `a`/`e` + `k` + `p`. Old
  clients that only understand kind-1 parent markers will NOT thread these
  replies. Replies under a kind-1 message root are unchanged (NIP-10 kind-1).

### Added

- Post context menu: tap a card body to open a small inline popup anchored at
  the tap point (same on phone and desktop) — a quick-emoji React row over a
  compact action row, scaled in from the anchored corner, clamped/flipped at
  viewport edges, with no dimmed backdrop (a transparent click-catcher or
  Escape dismisses it). Actions: Reply (focuses the thread — the entry point
  for reply-less posts), Copy link (permalink `origin/relayHost/eventId`), and
  for own items Recompose… (kinds 1 and 1111: prefills the composer,
  replacement inherits kind/channels/thread/origin relay, the original is
  deleted only after the replacement publishes) and Delete (NIP-09 kind 5),
  both behind inline two-step confirms.
- The menu, replies, reactions and delete now work on EVERY post kind,
  including calendar events (NIP-52). A calendar card gets the same tap→popup;
  replying to a calendar event roots a NIP-22 comment at its addressable
  `kind:pubkey:d` coordinate; deleting an own calendar event tombstones it by
  `e` + `k` + `a`. Recompose stays kinds 1 and 1111 only.
- Reactions (NIP-25): posts AND calendar cards show per-emoji count chips (own
  reaction highlighted); tapping toggles/switches. 👍/👎 normalize to `+`/`-`
  on the wire; the `k`-tag carries the target's kind. Reactions and deletions
  publish to every connected relay that delivered the target (per-relay
  attribution). Same-emoji re-react deletes the prior reaction; a different
  emoji replaces it newest-wins.
- Shared-link resolution: opening a permalink (`origin/relayHost/eventId`)
  focuses the thread on boot and cleans the URL (`replaceState`) so a reload
  doesn't re-trigger; an unknown relay host in the link is added as a space.
  The thread back bar now renders whenever a thread is focused — even before
  the post/event has streamed in (title falls back to "Thread") — so a deep
  link to a not-yet-loaded post is never a trap.
- Cross-client note: the `classify-events.json` "unknown kind ignored"
  sample kind changed 7 → 12345 (kind 7 is now a classified reaction; the
  vector's expectation is unchanged).

- Spaces are auto-detected during sign-in, so onboarding rarely asks for one:
  the account's own relays, else the tenant defaults noas now advertises at
  discovery (`noas.relays`), else a WebSocket probe of
  `wss://<subdomain>.<root-domain-of-the-noas-host>` (default `tasks, feed,
  relay, nostr`; `VITE_SPACE_PROBE_SUBDOMAINS` overrides) that adopts the first
  reachable relay. The "connect your space" step now appears only when all
  three come up empty.
- Profile pictures upload straight to noas (the account's only media endpoint):
  tap the avatar to pick a photo, which is resized on-device and stored via
  `/auth/update`. The image-URL field moved behind a disclosure. Applies to
  both onboarding and the profile editor. Uploads need a fresh sign-in (the
  password hash is now kept with the session for this); otherwise the URL field
  is offered.

### Changed

- The profile editor opens instantly: it reuses the kind-0 already streamed by
  the live subscription as the merge base instead of always waiting on a
  network fetch (the fetch stays as a cold-start fallback), so fresh signups no
  longer fetch twice. A timed-out or empty fetch is never cached, so editing
  can never overwrite a real profile with a blank.
- The space selector is now an icon-first dropdown: the collapsed pill shows
  only the active space's host-derived icon (a neutral layers glyph for "All
  spaces"), space names appear once it's open, "Add a space" is inline at the
  bottom, and the connected-count badge is gone. The same per-space icons
  replace the colored attribution dots throughout (space lists, "Delivered by"
  sheet).
- Feed cards only show per-space attribution when the feed spans more than one
  space — with a single space in scope the marker was redundant. The task/event
  icon no longer sits in its own leading column before the avatar; it renders
  inline in the message body, before the text.
- Onboarding lost its standalone welcome/"let's go" screen — the greeting is
  now the profile step's heading — and drops the website field (it stays in the
  full profile editor). Display name defaults to the username with a capital
  initial. On a mobile browser that isn't installed, a final step recommends
  adding Nodex to the home screen.

- The composer sends to the current context. With no space selected it now
  resolves the target space from where the draft's channels live: a channel
  that exists on a single space posts there with no prompt; a channel that
  spans several spaces shows a space picker in the bar and requires a pick.
- Attach a calendar event to a message: the composer's calendar button opens
  a form (title, all-day/timed, start, optional end and location) and the
  message posts as a NIP-52 event (kind 31922/31923) carrying the draft's
  channels, to the resolved space. Posted events render as calendar cards in
  the timeline.

- New design tokens: light #FAFAFC/#FFFFFF with #4785FF main and #C7D9FF
  muted accents; dark mode is OLED-friendly full black with 57%-composited
  accents. The logo always renders in the full accent color; favicon and
  PWA icons match.
- The startup animation inverts: the two strokes now slide together, and
  when signed out the assembled logo glides into the sign-in card's glyph.
- Sign-in and registration lost the server field: user@domain picks the
  server, plain usernames use the default host. Registration adapts to the
  discovered host (email only when verification is required) and gains
  nodex's key handling — paste hex/nsec with npub preview, or mine a vanity
  key from your username's initials (auto after 4+ chars, worker-backed).
- Pinned channels are per-space: pinning applies to the selected spaces
  that have content in the channel at pin time; display and default feed
  scope follow the current space selection.
- The space-switcher pill is back in the mobile top bar next to the menu.

- PWA manifest with app icons — the app can be installed to the home screen
  (standalone display, dark splash matching the theme). The onboarding's
  channel step now shows a short install hint with per-OS steps (share
  sheet on iOS, browser menu on Android — browser-neutral wording), hidden
  when already installed or on desktop.
- Spaces can be added any time (menu / sidebar), and sign-in works for
  accounts with no space — onboarding then starts by connecting one.
- Feed renders incrementally (recycler-style window over the newest ~80
  items, "show older" on scroll-up) and stays pinned to the newest message
  through hydration bursts and resizes.

### Fixed

- Focusing a nested reply now scopes the timeline to that reply's own subtree
  (its ancestors for breadcrumb context plus its own descendants) instead of
  always expanding to the entire top-level thread; sibling branches under a
  shared ancestor are excluded.
- Selecting a topic now scopes cleanly: it drops any included channel the
  topic doesn't tag (which would otherwise AND the feed to nothing), hides
  channels the topic doesn't tag, lights up its own channels, and surfaces
  under every one of them (primary or auxiliary). Tapping a highlighted
  channel while a topic is active now commits to that channel (dropping the
  topic) instead of clearing everything; a channel only toggles off when it is
  the sole active thing.
- Reply threading now uses proper NIP-10 tags. Incoming replies that carry
  only a `root` marker (the standard top-level-reply form) finally link into
  their thread instead of showing as orphans; the legacy `parent` marker still
  reads for nodex/mostr compatibility.
- Composing inside a focused thread now actually posts a reply: a "replying
  to" chip appears, the reply inherits the parent's channels (no `#channel`
  needed), carries NIP-10 `root`/`reply` `e`-tags + participant `p`-tags, and
  publishes to the parent's origin relay.
- A search that matches nothing falls back to the unsearched (still scoped)
  feed instead of a blank screen — so composing a brand-new message no longer
  blanks the timeline as you type.
- Smooth scrolling during hydration: the backfill now applies in coarse
  batches (fast first paint, then ~2 flushes/s until EOSE) instead of
  rebuilding the timeline per incoming event, and the history window is
  adjusted before render so arriving batches no longer shift what you are
  reading.

### Changed

- Focusing a thread now hides the nav row (hamburger / space / channels) and
  replaces it with a full-width back bar — tapping anywhere on it exits the
  thread.

### Changed

- Hashtag/color rule: UPPERCASE hex and digit-only tokens (3/4/6/8 chars)
  are colors — `#fee` stays a channel, `#FEE` and `#123` do not. Uppercase
  `T`/`P`/`E` tags now count as channel/mention/deletion tags.
- Posts parse media attachments (imeta / NIP-94-style tags) and NIP-52
  calendar events (kinds 31922/31923) are ingested per `(pubkey, d)` —
  domain + spec-vector level; UI rendering follows later.
- **Topics are now shared relay events** (addressable kind 30177, see
  `docs/nip-topics.md`): every user of a space sees the same topics, newest
  definition per channel set wins across authors (a topic is identified by the channels it contains, not its name), deletion per NIP-09. Pinned state
  stays personal (stored per account next to pinned channels). Topics unfold
  under any of their selected channels; the primary channel only drives
  auto-selection and the sidebar placement. Selecting a channel switches
  over from a selected topic instead of stacking.
- Documented all Nodex protocol conventions in `docs/nostr-extensions.md`
  (NIP-34 task-kind divergences, `parent` reply marker, NIP-38 presence
  usage, noas well-known extension, per-relay attribution).
- Removed the remaining layout width caps — the timeline uses the full
  window at every size.

- **Topics**: named, composable tag combinations instead of sub-channels
  ("Nodex User Stories" = #design + #nodex). Each topic has a primary
  channel plus secondary channels, picked freely in the creation sheet (no
  prior selection needed). Topics render as subitems of their primary
  channel — unfolding after the selected channel chip, nested in the
  sidebar; pinned topics stay always visible, and selecting one with no
  channel active auto-selects its primary channel. Their tags compose into
  the filter and into published posts; long-press to pin or delete.
- Create-account option at sign-in: generates the key on-device,
  NIP-49-encrypts it with the password, mirrors nodex registration
  (optional email verification).
- Full internationalization with German translations; language switch in
  the menu and sidebar, auto-detected from the browser.
- Per-space profile editing any time after onboarding (menu → Edit profile
  / sidebar user card): "All spaces" or a single space, each with its own
  kind-0.
- Long-press (or right-click) channel chips and sidebar entries to
  pin/unpin.
- The server field is optional at sign-in and registration: `user@domain`
  fills it automatically.

### Changed

- The feed flows like a chat: newest messages at the bottom, auto-scrolled
  unless you scrolled up to read history.
- Profiles load much faster: kind-0 events stream on their own
  subscription opened before the content backfill, and missing authors are
  fetched in a targeted pass after EOSE.
- One fluid, seamless layout across all screen sizes — no edge borders;
  bottom sheets cap their width on large screens.

- Desktop layout (≥900px): persistent sidebar with space selector, per-relay
  connection status, vertical channel list, and user card — replacing the
  mobile hamburger and chips row.
- Interactive timeline: reply headers are clickable breadcrumb chains, and
  clicking a crumb, reply indicator, or state-row task focuses that whole
  conversation (dismissible thread bar). Author names, avatars, and
  @mentions show profile hover cards; channel chips on cards filter on click.
- Onboarding profile step is a full profile editor (picture URL with
  preview, display name, bio, website), prefilled from the existing kind-0
  fetched off the relays; publishing merges into it so unknown profile
  fields survive.

- Onboarding flow after first sign-in: welcome, profile setup (display name,
  optional bio, account picture published as kind-0 profile), and channel
  picks that become the pinned default feed scope.
- `user@domain` usernames sign in without filling the server field; an
  explicitly typed server still wins.
- Timeline: compact rows for task state updates, parent-context headers on
  replies, status icons with strikethrough for finished tasks, mention and
  channel chips on cards, linkified URLs with show-more clamping, channel
  chips with post counts (pinned first).
- The bottom bar doubles as live search even with no channel selected; typed
  #hashtags scope the feed and become the post's channels.
- Hamburger menu sheet with space selector, per-relay connection status, and
  sign-out.

### Fixed

- Timeline backfill was shallow: profile/state/deletion events consumed the
  same relay limit as messages. Subscription filters are now split per
  concern with their own limits.

## [0.1.0] - 2026-07-03

Initial ground-up Svelte 5 rewrite: splash → noas sign-in → mobile timeline
with per-relay attribution dots and delivery sheet, channel chip filtering,
space selector, and rule-checked publishing.
