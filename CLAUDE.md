# CLAUDE.md

## Commands

```sh
npm run dev          # Dev server on port 8081
npm run build        # Production build
npm run check        # svelte-check typechecking (must be clean)
npx vitest           # Run all tests
npx vitest run src/path/to/file.test.ts  # Run a single test file
```

## Architecture

**Nodex Next** is the ground-up Svelte rewrite of Nodex (`../nodex`), scoped
to the mobile Timeline (team messaging). Build spec: `../nodex-talk/SPEC.md`;
product intent: `../nodex/nodex-talk.md`. Events are compatible with
nodex/mostr on the same relay (kinds 0, 1, 5, 1621, 1630–1633).

### Layers (dependency direction: components → stores → infrastructure → domain)

- `src/domain/` — pure, dependency-free TypeScript. No Svelte, no NDK, no
  browser APIs. Post/Person/Channel types, event classification
  (`event-to-post.ts`), publish rules, relay identity, content tokenizing.
  This layer is the invariant spec: every behavior change here needs a test.
- `src/infrastructure/` — noas auth client (`noas/`) and the NDK wrapper
  (`nostr/ndk-service.ts`). Framework-free; returns data, throws typed errors.
- `src/stores/` — Svelte 5 rune stores (`.svelte.ts` classes with `$state`).
  `timeline` (event ingest), `filters` (chips + space), `preferences`
  (onboarding flag + pinned channels, per pubkey), `auth`, and
  `timeline-controller` (commands only — controllers never expose setters).
- `src/components/` — one component per file, scoped styles, no CSS framework.
  Design tokens live in `src/app.css`.
- `src/lib/` — shared helpers outside the layer stack: i18n (every
  user-facing string goes through `t()` and needs entries in both `en.ts`
  and `de.ts`), splash, long-press. Static assets live in `public/`;
  before touching icons read `public/icons/README.md`.

### Non-negotiable invariants

- **Per-relay attribution.** Every post tracks which relay ids delivered it.
  The NDK event cache stays disabled; ingest listens to both `event` and
  `event:dup` and union-merges relays (`timeline.svelte.ts › ingestPost`).
  Events without a delivering relay are dropped. Never "simplify" this away.
- **Channels are hashtags** (`t`-tags ∪ content hashtags, lowercased, no
  NIP-28); **spaces are relays**; empty space selection = "All spaces",
  never "no relays". Channel filters are AND.
- **Publish rules** (`domain/publish-rules.ts`): ≥1 channel required; new
  posts target exactly one relay (active space → sole connected → error);
  replies pin to the parent's origin relay. Profiles (kind 0) go to all spaces.
- **Deletions** (kind 5) tombstone only the author's own events (NIP-09).
  State events 1630–1633 fold into their task's `stateUpdates` (newest-first)
  and render as compact rows, never as post cards.

## Code Standards

- Max ~300 lines per file; split at natural boundaries.
- New `$effect` calls need a one-line `// why:` comment (trigger + observable
  result).
- localStorage holds caches/preferences the app can rebuild. Reject malformed
  entries — never write migration code; bump the key prefix for a clean cut.
- No `aria-*` attributes (visual-only app). Query tests by visible fixture
  data first, `data-testid` last-resort. `<!-- svelte-ignore a11y_* -->` is
  the sanctioned way to silence the compiler's a11y warnings.
- Pure derivations over `Post` are plain functions in `domain/` (no `use`
  prefix, param named `post`).
- Tests: vitest, node environment, behavior over implementation detail.
  Fixtures in `src/test/fixtures.ts` (realistic hex pubkeys/ids). Domain and
  store logic must be testable without a DOM.
- **Cross-client spec vectors** live in `spec/vectors/*.json`
  (see `spec/README.md`) and are consumed by `src/test/vectors-*.test.ts`;
  the mobile client runs the same vectors. Behavior changes to domain/store
  semantics land in the vectors FIRST, then in the code; never edit an
  existing vector expectation without flagging it as a breaking spec change.

## Workflow

- Use Conventional Commits: `feat:`, `fix:`, `enhance:`, `refactor:`,
  `test:`, `docs:`, `chore:`
- Commit after each self-contained change; for multi-step work commit at each
  natural checkpoint rather than batching.
- Prefer `git commit -m "..." <explicit file list>`; `git add` new files
  first (a pathspec commit errors on untracked paths), and run `git status`
  afterwards to confirm nothing was left behind.
- Keep `CHANGELOG.md` updated: user-visible changes go to `## [Unreleased]`
  as you go. Skip internal-only changes.
- When user-observable behavior changes, update `README.md`'s behavior notes
  in the same commit.
- `npm run check` and `npx vitest run` must both be clean before finishing.
