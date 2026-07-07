# Deploying nodex-next

The app is a static Vite/Svelte build served by nginx (see `../Dockerfile`).
It ships one stack file, `../compose.yml`, that works two ways: plain Docker
Swarm and Co-op Cloud (abra). Traefik terminates TLS and routes by hostname.

## Two different `.env` files

| File | When it's read | Holds |
| --- | --- | --- |
| `../.env` (from `../.env.example`) | at **`docker build`** — baked into the JS bundle | `VITE_NOAS_HOST_URL`, `VITE_SPACE_PROBE_SUBDOMAINS` |
| `deploy/.env` (from `deploy/.env.sample`) | at **deploy** by docker/abra | `DOMAINS`, `LETS_ENCRYPT_ENV`, `STACK_NAME`, `IMAGE` |

The build config is baked in at image build time, so the CI/registry build
that produces the image for abra must have a `../.env` in the context (or use
the app defaults documented in `../.env.example`). The deploy config is read
later and is what changes per host.

## Plain Docker Swarm

Single-node, locally built image — no registry needed:

```sh
make build                       # docker build -t nodex-next:latest .
cp deploy/.env.sample deploy/.env   # set DOMAINS=..., LETS_ENCRYPT_ENV=...
make deploy                      # runs deploy/deploy.sh
```

`deploy/deploy.sh` expands the comma-separated `DOMAINS` list into a Traefik
rule and calls `docker stack deploy`. Prereqs: the swarm's Traefik is on an
external overlay network named `proxy` (the Co-op Cloud traefik recipe creates
it; otherwise `docker network create -d overlay proxy`).

### Multiple domains

Just list them — no Traefik syntax in the env file:

```sh
DOMAINS=nodex.example.com,app.example.org,tasks.example.net
```

One service answers all of them (the app is domain-agnostic), and Let's
Encrypt issues a cert per host. `deploy.sh` turns that into:

```
Host(`nodex.example.com`) || Host(`app.example.org`) || Host(`tasks.example.net`)
```

## Co-op Cloud (abra)

abra is single-domain per app and pulls a **pre-built image from a registry**
(it never builds). So push first:

```sh
make build push IMAGE=git.example.com/you/nodex-next:0.1.0
```

Then, with this repo available as a recipe under `~/.abra/recipes/nodex-next`:

```sh
abra app new nodex-next nodex.example.com   # creates the app env file
abra app config nodex.example.com           # set IMAGE, LETS_ENCRYPT_ENV, ...
abra app deploy nodex.example.com
abra app logs|restart|undeploy nodex.example.com
```

For abra multi-domain, set `ROUTER_RULE` explicitly in the app env (abra does
not expand the `DOMAINS` list — only `deploy.sh` does).

Recipe files in this repo: `../compose.yml`, `../abra.sh`, `deploy/.env.sample`.

## Registry & versioned images

An image reference is `[registry-host/]namespace/name:tag[@sha256:digest]`. With
no registry host it defaults to Docker Hub; otherwise it names your registry —
`ghcr.io/polygongmbh/nodex-next:…` (GitHub, the default here), a self-hosted
`git.example.com/you/nodex-next:…` (Forgejo), or a bare `registry:2`.

The Makefile defaults `REGISTRY` to `ghcr.io/polygongmbh`:

```sh
docker login ghcr.io -u polygongmbh   # once; PAT with write:packages as the password
make release                          # build + push ghcr.io/polygongmbh/nodex-next
```

Override `REGISTRY=git.example.com/you` to push to a self-hosted registry.

`make release` builds and pushes two tags:

- `:<commit-date>-<short-sha>` (e.g. `20260707-b4ef243`) — immutable, never
  overwritten, sorts chronologically, traceable to the exact commit.
- `:latest` — moving pointer to the newest build.

It refuses to push a dirty tree, so every pushed tag rebuilds byte-for-byte
from a known commit. The build id is also baked into the image and served at
`https://<host>/version.txt`, so you can confirm which build is live.

### Why a registry — and why it's the key to regression hunting

Each Swarm node (and abra) pulls the image independently, so a locally built
image only exists on the build node; the registry is the shared distribution
point. It's also your regression time machine: because every build was pushed
under an immutable tag, you jump to any prior version by *pulling* it — never
rebuilding:

```sh
make deploy IMAGE=ghcr.io/polygongmbh/nodex-next:20260701-abc1234   # plain swarm
# via abra: set IMAGE in the app env, then `abra app deploy <domain>`
```

`curl https://<host>/version.txt` confirms the rollback landed. To bisect a
regression, deploy tags between the last-good and first-bad dates and check
each. Tags are mutable pointers; for an absolutely pinned deploy use the digest
form `name@sha256:…` (from `docker inspect` / the registry) — content-addressed
and unable to move.

GHCR packages are private by default, so tasks need credentials to pull —
deploy with `REGISTRY_AUTH=1` (adds `--with-registry-auth`, bundling the node's
login into the service). For a single node running a **local-only** image that
was never pushed, deploy with `RESOLVE_IMAGE=never` to skip the registry
lookup. Both are read by `deploy.sh` from the environment or `deploy/.env`.

Registries accumulate images, so set a retention/GC policy or prune old tags
periodically (most registries expose a UI or API for it).

> abra's `abra app deploy <domain> <version>` pins the *recipe* version (the
> compose.yml), which is separate from the *image* tag. For app-code
> regressions, change `IMAGE`.

## Troubleshooting

**Task loops ~90s after start, log shows `SIGQUIT` and no access lines.** The
health check never connected, so Swarm killed the task as unhealthy (3 ×
`interval` + `start_period`). The image serves **IPv4-only** — nginx's
`10-listen-on-ipv6-by-default.sh` skips configs that differ from its packaged
default (ours does) — so probe/curl `127.0.0.1`, not `localhost` (which can
resolve to `::1` first). The health check is fixed accordingly. The effective
health check is the one in `compose.yml` (it overrides the image's), so a plain
`make deploy` picks up the fix without rebuilding the image.

## abra vs. plain `docker stack deploy`

Neither is your dev loop — active development is `npm run dev` (Vite HMR);
both only enter at deploy time, and both need a `docker build`. What differs
is the ops layer around the deploy:

- **abra** adds centralized per-app env/secret management, lifecycle commands
  (deploy/undeploy/logs/rollback, backup hooks), version-pinned reproducible
  deploys, and multi-server/multi-app management from one workstation. Cost: a
  registry image is mandatory, plus recipe conventions to maintain.
- **plain `docker stack deploy`** (via `deploy.sh`) is less ceremony and can
  use a locally built image on a single node. No secret/lifecycle tooling.

Both drive the same `compose.yml`, so it isn't either/or: keep `deploy.sh` for
fast single-node iteration, and wire up abra when you want its ops ergonomics
(worth doing early if Co-op Cloud hosting is the long-term intent).
