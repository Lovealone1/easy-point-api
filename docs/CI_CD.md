# Deploying without signing everybody out

Two questions that turn out to be one: *how do we restart the API without
losing the sessions in Redis*, and *how do changes on `master` reach the server
without anyone opening an SSH session*.

They are the same question because the only reason a deploy would drop sessions
is a deploy that touches more than it needs to. The answer to both is a
pipeline that replaces exactly one container.

---

## 1. Restarting the API does not lose sessions, and never did

Sessions live in Redis, which is a **different container** from the API:

```
caddy ──▶ easy-point-api        (replaced on every deploy)
            │
            ├──▶ social-redis   (sessions; volume redis_data)
            └──▶ postgres       (volume postgres_data)
```

`docker compose up -d --no-deps easy-point-api` stops and recreates that one
container. Redis keeps running, with its keys, its TTLs and its clients. A
session is a Redis key plus a signed token in the user's cookie jar, and a
deploy touches neither.

Redis survives its *own* restart too: `redis_data` is a named volume, and
production runs with `--appendonly yes`, so the append-only file is replayed on
boot. The exposure there is `appendfsync everysec` — the last second of writes
if the process is killed rather than stopped. For sessions that is at most one
sign-in.

So the thing to protect is not persistence. It is the list in §2.

---

## 2. What actually signs everybody out

| Action | What happens | Why |
|---|---|---|
| `docker compose down -v` | **Every session gone, permanently** | `-v` deletes `redis_data` *and* `postgres_data`. This is the one command that can end the company's day. |
| Rotating `JWT_SECRET` | **Every session gone** | The Redis entries survive, but no token verifies against the new secret, so nothing can reach them. |
| Rotating `JWT_REFRESH_SECRET` | Everyone signed out within ~15 min | Access tokens keep working until they expire; nothing can refresh after that. |
| Changing `REDIS_KEY_PREFIX` or `REDIS_DB` | **Every session gone** | `JwtAuthGuard` looks up the session under the new prefix and finds nothing. The old keys are still there, unreachable, until their TTL. |
| Changing the shape of a session key in code | Every session gone | What the dashboard/console split did once, deliberately — see `docs/SESSIONS.md`. |
| An eviction policy that can evict keys with a TTL | Random sign-outs under memory pressure | Every session has a TTL, so `allkeys-lru`, `volatile-lru` and friends treat them as fair game. Pinned to `noeviction` in `compose.prod.yaml`. |
| Redis killed by the container memory limit, with no AOF | Up to the last snapshot | Mitigated by `--appendonly yes` plus a `--maxmemory` ceiling *below* the container limit. |
| `docker compose down` (no `-v`) | Nothing lost, but full downtime | The volume survives and the AOF replays. |
| Changing `REDIS_PASSWORD` | Nothing lost | The container is recreated, the volume is not. |
| **Replacing the API container** | **Nothing lost** | The point of this document. |

Two consequences worth stating plainly:

- **Never run `docker compose down -v` on the server.** Not to "reset", not to
  "clean up". `deploy/deploy.sh` never does, and it prunes only dangling
  images, never volumes.
- **Treat `JWT_SECRET` as the sign-out switch.** It is the correct thing to
  rotate after a suspected token leak, and the wrong thing to touch during
  routine work. Same for `REDIS_KEY_PREFIX`.

### Proving it, on the server

Before a deploy:

```bash
docker compose -f compose.yaml -f compose.prod.yaml exec social-redis \
  redis-cli -a "$REDIS_PASSWORD" --no-auth-warning \
  --scan --pattern 'easy-point:session_metadata:*' | wc -l
```

Run the deploy, then run it again. The number should be the same or larger,
never zero. (`easy-point` is `REDIS_KEY_PREFIX`; `--scan` rather than `KEYS`,
which blocks the server.)

---

## 3. The gap that did exist: the 502 window

Sessions survived a deploy. *Requests* did not. With one API container behind
Caddy, everything arriving between "old container stops" and "new container
listens" — five to fifteen seconds — got a 502.

`Caddyfile` now sets `lb_try_duration 30s`. Caddy holds a request it could not
dispatch and retries it rather than failing it, so those requests are served a
few seconds late instead of erroring. Retries only ever happen for requests
that never reached an upstream, so a `POST` cannot be applied twice.

The cost is the inverse case: if the API is genuinely down, a client waits 30
seconds before hearing about it. That is the right trade here because the
deploy script rolls back anything that fails readiness, so "down" is measured
in seconds by construction.

**If that is ever not enough**, the next step is two API replicas with Caddy
`dynamic a` upstreams and active health checks, which removes the window
entirely. It is not done now because it requires dropping `container_name` from
the service (it blocks scaling), and because a 30-second retry window already
covers a boot an order of magnitude shorter. Do it when a deploy needs to be
invisible, not before.

---

## 4. The pipeline

```
push to master
   │
   ├─▶ checks.yml        typecheck (tsconfig.build.json) · unit tests · lint (advisory)
   │
   ├─▶ build             GHCR: <repo>:<sha>  (runner stage)
   │                     GHCR: <repo>:migrate-<sha>  (build stage — has the Prisma CLI)
   │
   └─▶ deploy            scp the compose files + Caddyfile + deploy.sh
                         ssh → deploy/deploy.sh <sha>
                              pull → migrate → up -d --no-deps easy-point-api
                              → wait for /health/ready → roll back if it never comes
```

Three properties that are the whole point:

**The server never builds.** A 2 vCPU box compiling TypeScript and installing
`node_modules` is several minutes under memory pressure, during the exact
window the API is being restarted. The runner builds once; the server pulls.

**The server never pulls from git.** There is no remote, no deploy key and no
working tree on the VPS. The four things it needs — `compose.yaml`,
`compose.prod.yaml`, `compose.registry.yaml`, `Caddyfile` — plus `docker/` and
`deploy/` arrive over `scp` as part of the deploy. `.env` is the one thing the
pipeline does not own: it lives on the server and nothing overwrites it.

**Only the API container is replaced.** `--no-deps` in `deploy.sh` is what
keeps Postgres and Redis out of the blast radius. Removing that flag is how a
future deploy quietly starts signing people out.

### Rollback

Two paths, in order of preference:

1. **Automatic.** If the new container does not answer `/api/v1/health/ready`
   within 90 seconds, `deploy.sh` restarts the previous image *by image ID*
   (not tag — tags get overwritten, IDs do not) and exits non-zero. The deploy
   is red and production is on the old build.
2. **Manual.** Actions → Deploy → *Run workflow*, and put a previous commit SHA
   in the `tag` input. It skips the build and redeploys that exact artefact.
   This is why nothing ever resolves `:latest`: "deploy latest" and "roll back"
   cannot both be true.

Neither rolls back a migration. Prisma migrations are forward-only, which is
why they run *before* the new container: old code tolerates a column it does
not know about, new code against an un-migrated database does not. A schema
change that genuinely needs reverting needs a hand-written down-migration —
see `docs/DEPLOYMENT.md` §7.

---

## 5. One-time setup

### On the server

```bash
sudo install -d -o deploy -g deploy /opt/easy-point-api
# Move the existing .env into place if it is not already there.
# Nothing else is needed — the first deploy ships the compose files.
```

The `deploy` user must be in the `docker` group (it already is, per
`docs/DEPLOYMENT.md` §2).

### The SSH key

Generate a key **used only by CI**, and give it nothing but this one server:

```bash
ssh-keygen -t ed25519 -C 'github-actions@easy-point' -f ./ci_deploy -N ''
ssh-copy-id -i ./ci_deploy.pub deploy@<host>     # or append to authorized_keys
ssh-keyscan -t ed25519 <host>                    # → DEPLOY_KNOWN_HOSTS
```

`ssh-keyscan` output goes into a secret rather than the workflow using
`StrictHostKeyChecking=no`. Without pinning, anything that can answer on that
address gets handed a registry token and a shell command.

### Repository secrets and variables

| Name | Kind | Value |
|---|---|---|
| `DEPLOY_HOST` | secret | VPS hostname or IP |
| `DEPLOY_USER` | secret | `deploy` |
| `DEPLOY_SSH_KEY` | secret | contents of `ci_deploy` (the private half) |
| `DEPLOY_KNOWN_HOSTS` | secret | `ssh-keyscan` output for the host |
| `DEPLOY_DIR` | variable | optional; defaults to `/opt/easy-point-api` |

No registry credential is stored. The deploy logs the server into GHCR with the
job's own `GITHUB_TOKEN`, which expires when the job ends, and logs it out
again afterwards — so a compromised VPS does not yield a registry credential
that outlives the incident.

### GHCR visibility

The package is private by default, which is correct. The `GITHUB_TOKEN` login
above is what gives the server access; nothing needs to be made public.

### Approvals

The `deploy` job runs in the `production` GitHub environment. Attach required
reviewers to it in repository settings if a human should confirm each release.
Nothing in the code needs to change.

---

## 6. What is deliberately not automated

- **`.env` changes.** Secrets are not in git and the pipeline does not write
  them. Edit `.env` on the server, then re-run the deploy so the API restarts
  with them.
- **Destructive migrations.** `prisma migrate deploy` applies whatever is in
  `prisma/migrations`. A migration that drops a column will be applied without
  ceremony. Review those on the pull request, not on the server.
- **Postgres and Redis upgrades.** Changing the `postgres:17` or `redis:7-alpine`
  tag means a planned maintenance window, not a `git push`.
- **Lint as a gate.** `checks.yml` runs it with `continue-on-error: true`. The
  repository has a backlog of prettier findings that predate this pipeline, and
  making them blocking from day one would mean every deploy is red for reasons
  unrelated to the change. Clear the backlog, then delete that flag — an
  advisory check nobody ever promotes is an advisory check nobody reads.
