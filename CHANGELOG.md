# Changelog

## [Unreleased]

### Added

- Spaces are auto-detected during sign-in, so onboarding rarely asks for one:
  the account's own relays, else the tenant defaults noas now advertises at
  discovery (`noas.relays`), else a WebSocket probe of
  `wss://<subdomain>.<root-domain-of-the-noas-host>` (default `tasks, feed,
  relay, nostr`; `VITE_SPACE_PROBE_SUBDOMAINS` overrides) that adopts the first
  reachable relay. The "connect your space" step now appears only when all
  three come up empty.

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

- Smooth scrolling during hydration: the backfill now applies in coarse
  batches (fast first paint, then ~2 flushes/s until EOSE) instead of
  rebuilding the timeline per incoming event, and the history window is
  adjusted before render so arriving batches no longer shift what you are
  reading.

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
