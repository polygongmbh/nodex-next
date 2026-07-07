#!/usr/bin/env sh
# Expand a comma-separated DOMAINS list into a Traefik router rule, then run
# `docker stack deploy`. This keeps deploy/.env free of Traefik rule syntax.
#
#   ./deploy/deploy.sh                      # reads deploy/.env
#   ENV_FILE=/path/to/other.env ./deploy/deploy.sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/deploy/.env}"

# An IMAGE passed in the environment (e.g. `make deploy IMAGE=repo:oldtag` to
# test an older build) wins over the value in the env file.
IMAGE_OVERRIDE="${IMAGE:-}"

# Load deploy config and export it so `docker stack deploy` can interpolate it
# into compose.yml (a plain `.` sources without exporting; set -a fixes that).
if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

[ -n "$IMAGE_OVERRIDE" ] && export IMAGE="$IMAGE_OVERRIDE"

STACK_NAME="${STACK_NAME:-nodex-next}"
# Accept a single DOMAIN (older env files) as a fallback for the DOMAINS list.
DOMAINS="${DOMAINS:-${DOMAIN:-}}"
: "${DOMAINS:?set DOMAINS (or DOMAIN) in $ENV_FILE, e.g. DOMAINS=a.example.com,b.example.org}"

# First entry is the canonical domain (coop-cloud version label + fallback rule).
DOMAIN="${DOMAINS%%,*}"

# Build:  Host(`a`) || Host(`b`) || ...
RULE=""
OLDIFS="$IFS"; IFS=','
for d in $DOMAINS; do
  d="$(printf '%s' "$d" | tr -d '[:space:]')"
  [ -z "$d" ] && continue
  if [ -z "$RULE" ]; then
    RULE="Host(\`$d\`)"
  else
    RULE="$RULE || Host(\`$d\`)"
  fi
done
IFS="$OLDIFS"

export STACK_NAME DOMAIN ROUTER_RULE="$RULE"

# Optional `docker stack deploy` flags (set in the environment or deploy/.env):
#   REGISTRY_AUTH=1      -> --with-registry-auth: hand the node's registry
#                          credentials to tasks so they can pull a PRIVATE image
#                          (GHCR packages and most Forgejo registries default to
#                          private).
#   RESOLVE_IMAGE=never  -> --resolve-image never: skip the registry digest
#                          lookup; use for a local-only image on a single node.
set --
[ -n "${REGISTRY_AUTH:-}" ] && set -- "$@" --with-registry-auth
[ -n "${RESOLVE_IMAGE:-}" ] && set -- "$@" --resolve-image "$RESOLVE_IMAGE"

printf 'Deploying stack "%s"\n  rule: %s\n' "$STACK_NAME" "$ROUTER_RULE"
exec docker stack deploy "$@" -c "$ROOT/compose.yml" "$STACK_NAME"
