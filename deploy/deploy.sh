#!/usr/bin/env sh
# Pull, build, and deploy the nodex-next stack — one command for single-node,
# build-on-host deploys. Keeps deploy/.env free of Traefik rule syntax.
#
#   ./deploy/deploy.sh              # git pull + docker build + docker stack deploy
#   SKIP_PULL=1  ./deploy/deploy.sh # skip the pull (deploy the current checkout,
#                                    #   e.g. an older commit for regression tests)
#   SKIP_BUILD=1 ./deploy/deploy.sh # skip the build (redeploy the last image, or
#                                    #   a registry image named by IMAGE)
#   NO_CACHE=1   ./deploy/deploy.sh # force a clean rebuild (bust a stale layer)
#
# Knobs (env or deploy/.env): DOMAINS/DOMAIN, STACK_NAME, IMAGE, IMAGE_REPO,
#   LETS_ENCRYPT_ENV, RESOLVE_IMAGE, REGISTRY_AUTH.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/deploy/.env}"

# Env passed on the command line wins over the file (files are defaults).
IMAGE_OVERRIDE="${IMAGE:-}"
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi
[ -n "$IMAGE_OVERRIDE" ] && IMAGE="$IMAGE_OVERRIDE"

STACK_NAME="${STACK_NAME:-nodex-next}"
# Accept a single DOMAIN (older env files) as a fallback for the DOMAINS list.
DOMAINS="${DOMAINS:-${DOMAIN:-}}"
: "${DOMAINS:?set DOMAINS (or DOMAIN) in $ENV_FILE, e.g. DOMAINS=a.example.com,b.example.org}"
DOMAIN="${DOMAINS%%,*}"

git_do() { git -C "$ROOT" "$@"; }
in_git=0; git_do rev-parse --git-dir >/dev/null 2>&1 && in_git=1

# 1) Pull latest. Skip to deploy the current checkout (e.g. an older commit).
if [ "$in_git" = 1 ] && [ -z "${SKIP_PULL:-}" ]; then
  echo "==> git pull --ff-only"
  git_do pull --ff-only
fi

# 2) Build a uniquely-tagged local image. The unique tag is load-bearing:
#    `docker stack deploy` ignores a redeploy of an identical tag (e.g. :latest),
#    so a rebuilt :latest would never reach the running service. The tag also
#    doubles as the regression-hop handle. A local build => resolve never (step 4).
did_build=0
if [ -z "${SKIP_BUILD:-}" ]; then
  # repo = IMAGE without its :tag (IMAGE_REPO overrides; default nodex-next).
  img="${IMAGE:-nodex-next:latest}"
  case "$img" in
    *:*) t="${img##*:}"; case "$t" in */*) repo="$img" ;; *) repo="${img%:*}" ;; esac ;;
    *)   repo="$img" ;;
  esac
  repo="${IMAGE_REPO:-$repo}"
  sha="$(git_do rev-parse --short HEAD 2>/dev/null || echo nogit)"
  git_do diff --quiet 2>/dev/null || sha="${sha}-dirty"
  ver="$(date -u +%Y%m%d-%H%M%S)-${sha}"
  IMAGE="${repo}:${ver}"
  echo "==> docker build ${IMAGE}"
  # shellcheck disable=SC2086  # NO_CACHE expands to a flag or nothing
  docker build ${NO_CACHE:+--no-cache} --build-arg APP_VERSION="$ver" \
    -t "$IMAGE" -t "${repo}:latest" "$ROOT"
  did_build=1
fi
IMAGE="${IMAGE:-nodex-next:latest}"
export IMAGE

# 3) Traefik host rule from the domain list: Host(`a`) || Host(`b`) || ...
RULE=""
OLDIFS="$IFS"; IFS=','
for d in $DOMAINS; do
  d="$(printf '%s' "$d" | tr -d '[:space:]')"
  [ -z "$d" ] && continue
  if [ -z "$RULE" ]; then RULE="Host(\`$d\`)"; else RULE="$RULE || Host(\`$d\`)"; fi
done
IFS="$OLDIFS"
export STACK_NAME DOMAIN ROUTER_RULE="$RULE"

# 4) Image resolution. A locally built or registry-less image must NOT be
#    re-resolved against a registry (Swarm would fail to find it) — default to
#    never. A registry image (host has a dot/colon) resolves normally so the
#    pushed tag is pulled. RESOLVE_IMAGE overrides either way.
if [ -z "${RESOLVE_IMAGE:-}" ]; then
  if [ "$did_build" = 1 ]; then
    RESOLVE_IMAGE=never
  else
    case "$IMAGE" in
      */*) host="${IMAGE%%/*}"; case "$host" in *.*|*:*|localhost) : ;; *) RESOLVE_IMAGE=never ;; esac ;;
      *)   RESOLVE_IMAGE=never ;;
    esac
  fi
fi

set --
[ -n "${REGISTRY_AUTH:-}" ] && set -- "$@" --with-registry-auth
[ -n "${RESOLVE_IMAGE:-}" ] && set -- "$@" --resolve-image "$RESOLVE_IMAGE"

echo "==> docker stack deploy \"$STACK_NAME\""
echo "    image: $IMAGE"
echo "    rule : $ROUTER_RULE"
exec docker stack deploy "$@" -c "$ROOT/compose.yml" "$STACK_NAME"
