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

### Repo-specific invariant mechanics

The cross-cutting invariants live in the workspace `../CLAUDE.md`; the
normative behavior spec is `docs/rebuild-prompt.md`. Implementation notes
specific to this codebase:

- Attribution mechanics (JS-NDK-specific — dart-ndk needs per-relay
  subscriptions instead): NDK's event cache stays disabled; ingest listens
  to both `event` AND `event:dup` and union-merges relays
  (`timeline.svelte.ts › ingestPost`); relay-less events are dropped.

## Code Standards

- Max ~300 lines per file; split at natural boundaries.
- New `$effect` calls need a one-line `// why:` comment (trigger + observable
  result).
- No `aria-*` attributes (visual-only app). Query tests by visible fixture
  data first, `data-testid` last-resort. `<!-- svelte-ignore a11y_* -->` is
  the sanctioned way to silence the compiler's a11y warnings.
- Pure derivations over `Post` are plain functions in `domain/` (no `use`
  prefix, param named `post`).
- Tests: vitest, node environment, behavior over implementation detail.
  Fixtures in `src/test/fixtures.ts` (realistic hex pubkeys/ids). Domain and
  store logic must be testable without a DOM.
- Spec-vector adapters live in `src/test/vectors-*.test.ts` (governance:
  workspace `../CLAUDE.md` and `spec/README.md`); never edit an existing
  vector expectation without flagging a breaking spec change.

## Workflow

Commit/changelog conventions: workspace `../CLAUDE.md`. Repo-specific:

- `git add` new files before a pathspec commit (it errors on untracked
  paths); run `git status` afterwards to confirm nothing was left behind.
- Behavior changes update `README.md`'s behavior notes in the same commit.
- `npm run check` and `npx vitest run` must both be clean before finishing.
