# Changelog

## [Unreleased]

### Added

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
