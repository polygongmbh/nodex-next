#!/usr/bin/env bash
# PreToolUse(Bash) gate: before a `git commit` runs, require the repo to be
# green — svelte-check + i18n parity + vitest. Blocks the commit (exit 2) on
# any failure, enforcing CLAUDE.md's "each commit left green".
set -uo pipefail

input=$(cat)
# Cheap reject: only proceed when the payload mentions a commit at all.
case "$input" in *'git commit'*) ;; *) exit 0 ;; esac
# Confirm it is the actual command (not e.g. a message body) before spending time.
cmd=$(printf '%s' "$input" | node -e 'const fs=require("fs");try{process.stdout.write((JSON.parse(fs.readFileSync(0,"utf8")).tool_input||{}).command||"")}catch(e){}')
case "$cmd" in *'git commit'*) ;; *) exit 0 ;; esac
# `git commit --amend --no-edit` style metadata-only rewrites still get checked.

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${CLAUDE_PROJECT_DIR:-$(cd "$HOOK_DIR/../.." && pwd)}"

status=0
if ! out=$(npm run check 2>&1); then
  { echo "✗ npm run check (svelte-check) failed:"; echo "$out" | tail -40; } >&2
  status=1
else echo "✓ svelte-check" >&2; fi

if ! out=$(bash "$HOOK_DIR/i18n-parity.sh" 2>&1); then
  echo "$out" >&2
  status=1
else echo "✓ i18n parity" >&2; fi

if ! out=$(npx vitest run 2>&1); then
  { echo "✗ vitest failed:"; echo "$out" | tail -60; } >&2
  status=1
else echo "✓ vitest" >&2; fi

if [ "$status" -ne 0 ]; then
  echo "" >&2
  echo "Commit blocked: repo is not green (CLAUDE.md: each commit left green). Fix the above and re-commit." >&2
  exit 2
fi
exit 0
