#!/usr/bin/env bash
# Fails (exit 1) if en.ts and de.ts do not define the exact same key set.
# Called by pre-commit-gate.sh; also runnable standalone.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

EN=src/lib/i18n/en.ts
DE=src/lib/i18n/de.ts

# Extract top-level string keys: lines shaped like  "some.key":
keys() { grep -oE '^[[:space:]]*"[^"]+"[[:space:]]*:' "$1" | sed -E 's/^[[:space:]]*"([^"]+)"[[:space:]]*:.*/\1/' | sort -u; }

missing_de=$(comm -23 <(keys "$EN") <(keys "$DE"))
missing_en=$(comm -13 <(keys "$EN") <(keys "$DE"))

if [ -n "$missing_de$missing_en" ]; then
  {
    echo "i18n key mismatch between en.ts and de.ts (every t() key needs both):"
    [ -n "$missing_de" ] && { echo "  missing in de.ts:"; echo "$missing_de" | sed 's/^/    /'; }
    [ -n "$missing_en" ] && { echo "  missing in en.ts:"; echo "$missing_en" | sed 's/^/    /'; }
  } >&2
  exit 1
fi
