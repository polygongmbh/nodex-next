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
