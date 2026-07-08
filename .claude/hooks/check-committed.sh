#!/usr/bin/env bash
# Stop hook: when a turn ends with a dirty working tree, remind once to commit
# the finished units (CLAUDE.md: commit cohesive units as you finish them, and
# leave nothing uncommitted at session end). Guarded by stop_hook_active so it
# fires at most once per stop attempt and never loops.
set -uo pipefail

input=$(cat)
case "$input" in
  *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

dirty=$(git status --porcelain 2>/dev/null || true)
if [ -n "$dirty" ]; then
  {
    echo "Uncommitted changes remain:"
    echo "$dirty" | sed 's/^/  /'
    echo "Commit the finished cohesive units now (each left green), or state explicitly why they are left uncommitted."
  } >&2
  exit 2
fi
exit 0
