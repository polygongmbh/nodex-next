#!/usr/bin/env bash
# PostToolUse(Bash): after a `git commit`, warn if untracked files remain.
# Pathspec commits silently omit files that were never `git add`ed — this
# catches a new file that should have been part of the commit.
set -uo pipefail

input=$(cat)
case "$input" in *'git commit'*) ;; *) exit 0 ;; esac
cmd=$(printf '%s' "$input" | node -e 'const fs=require("fs");try{process.stdout.write((JSON.parse(fs.readFileSync(0,"utf8")).tool_input||{}).command||"")}catch(e){}')
case "$cmd" in *'git commit'*) ;; *) exit 0 ;; esac

cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

untracked=$(git status --porcelain 2>/dev/null | grep '^??' || true)
if [ -n "$untracked" ]; then
  {
    echo "Untracked files remain after the commit — if any belong with it, amend or make a follow-up commit:"
    echo "$untracked" | sed 's/^?? /  /'
  } >&2
  exit 2
fi
exit 0
