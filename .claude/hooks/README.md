# .claude/hooks

Commit-discipline gates for nodex-next, wired in `../settings.json`. They fire
when Claude Code runs with this repo as its project root (also reachable via
the workspace-level dispatchers in `../../.claude/hooks/`).

| Script | Event | Behavior |
|--------|-------|----------|
| `pre-commit-gate.sh` | PreToolUse(Bash) | On a `git commit`, runs `npm run check` + i18n parity + `npx vitest run`; blocks the commit (exit 2) if any is red. Fast-rejects non-commit Bash calls. |
| `post-commit-untracked.sh` | PostToolUse(Bash) | After a `git commit`, warns about leftover untracked files (a new file omitted from a pathspec commit). |
| `check-committed.sh` | Stop | If a turn ends with a dirty tree, reminds once to commit. Guarded by `stop_hook_active` so it never loops. |
| `i18n-parity.sh` | (helper) | Fails if `src/lib/i18n/en.ts` and `de.ts` don't define the same key set. Called by the gate; also runnable standalone. |

Scripts are invoked via `bash …` (no exec bit needed) and locate the repo via
`$CLAUDE_PROJECT_DIR`, falling back to their own path.

Enforce "each commit left green": the full `vitest` suite runs on **every**
commit. If that gets heavy during a long incremental series, drop the
`npx vitest run` block from `pre-commit-gate.sh` and rely on the Stop reminder
plus a manual end-of-session run.
