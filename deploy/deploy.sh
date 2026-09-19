#!/usr/bin/env bash
#
# Server-side deploy. Invoked over SSH by .github/workflows/deploy.yml:
#
#     deploy.sh <image-tag>
#
# Replaces the API container with a pre-built image and leaves everything else
# on the box alone. Postgres, Redis and Caddy are never recreated here, which
# is the whole reason a deploy does not sign anybody out — see docs/CI_CD.md.
#
# Safe to run by hand. Not safe to edit casually: three of the flags below are
# load-bearing and the comments say which.

set -Eeuo pipefail

readonly DEPLOY_DIR="${DEPLOY_DIR:-/opt/easy-point-api}"
readonly IMAGE_REPO="${IMAGE_REPO:?IMAGE_REPO must be set (e.g. ghcr.io/owner/easy-point-api)}"
readonly HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-90}"

readonly TAG="${1:?usage: deploy.sh <image-tag>}"

# Every compose invocation needs the same file stack. Getting this wrong is
# how a deploy accidentally runs the dev configuration in production.
readonly COMPOSE=(
  docker compose
  -f "${DEPLOY_DIR}/compose.yaml"
  -f "${DEPLOY_DIR}/compose.prod.yaml"
  -f "${DEPLOY_DIR}/compose.registry.yaml"
  --project-directory "${DEPLOY_DIR}"
)

export API_IMAGE="${IMAGE_REPO}:${TAG}"
export MIGRATE_IMAGE="${IMAGE_REPO}:migrate-${TAG}"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31m!!!\033[0m %s\n' "$*" >&2; exit 1; }

cd "${DEPLOY_DIR}"

[[ -f .env ]] || fail "no .env in ${DEPLOY_DIR} — secrets live on the server, not in the repo"

# ── 0. What is running now, so a failed deploy has something to go back to ──
# `.Config.Image` is the reference the container was created from —
# `ghcr.io/owner/repo:<sha>` — not the resolved image ID. The ID would be more
# precise but cannot be put back into compose's `image:` field, and `pull_policy`
# would then try to pull a sha256 digest as if it were a tag. Every tag this
# pipeline produces is a commit SHA and is never reused, so the reference is
# just as unambiguous.
PREVIOUS_IMAGE="$(
  container="$("${COMPOSE[@]}" ps -q easy-point-api 2>/dev/null || true)"
  [[ -n "${container}" ]] && docker inspect --format '{{.Config.Image}}' "${container}" || true
)"
readonly PREVIOUS_IMAGE

if [[ -n "${PREVIOUS_IMAGE}" ]]; then
  log "Current API image: ${PREVIOUS_IMAGE}"
else
  log "No API container running — this is a first deploy, rollback is unavailable"
fi

# ── 1. Pull ─────────────────────────────────────────────────────────────────
# Before anything is torn down: a registry outage should fail the deploy while
# the old container is still serving, not halfway through replacing it.
log "Pulling ${API_IMAGE} and ${MIGRATE_IMAGE}"
"${COMPOSE[@]}" --profile migrate pull easy-point-api migrate

# ── 2. Migrate ──────────────────────────────────────────────────────────────
# Prisma migrations are forward-only and additive, so they run before the new
# code rather than after: the old code tolerates a column it does not know
# about, while new code against an un-migrated database does not.
log "Applying database migrations"
"${COMPOSE[@]}" --profile migrate run --rm migrate

# ── 3. Replace the API container, and only the API container ────────────────
# `--no-deps` is the flag that keeps sessions alive. Without it, compose walks
# the dependency graph and may recreate `postgres` and `social-redis` too;
# recreating Redis drops every live session on the floor.
log "Starting ${API_IMAGE}"
"${COMPOSE[@]}" up -d --no-deps easy-point-api

# ── 4. Prove it actually serves traffic ─────────────────────────────────────
# `docker compose ps` is not evidence, and neither is the image HEALTHCHECK:
# that one calls /health, which returns ok with the database unreachable.
# /health/ready queries Postgres and Redis.
log "Waiting for readiness (up to ${HEALTH_TIMEOUT_SECONDS}s)"
deadline=$(( SECONDS + HEALTH_TIMEOUT_SECONDS ))
ready=false

while (( SECONDS < deadline )); do
  if "${COMPOSE[@]}" exec -T easy-point-api node -e "
      fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/v1/health/ready')
        .then(r => process.exit(r.ok ? 0 : 1))
        .catch(() => process.exit(1));
    " >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 3
done

if [[ "${ready}" != true ]]; then
  printf '\n--- last 80 lines from the failed container ---\n' >&2
  "${COMPOSE[@]}" logs --tail 80 easy-point-api >&2 || true

  if [[ -n "${PREVIOUS_IMAGE}" ]]; then
    log "Not ready — rolling back to ${PREVIOUS_IMAGE}"
    API_IMAGE="${PREVIOUS_IMAGE}" "${COMPOSE[@]}" up -d --no-deps easy-point-api
    fail "deploy of ${TAG} failed readiness; rolled back"
  fi

  fail "deploy of ${TAG} failed readiness and there is nothing to roll back to"
fi

# ── 5. Reverse proxy ────────────────────────────────────────────────────────
# The Caddyfile is a bind mount, so a changed file does not recreate the
# container and Caddy keeps serving the config it parsed at boot. `reload` is
# graceful — no dropped connections, no reissued certificates — and a no-op
# when nothing changed, so it runs unconditionally rather than behind a
# checksum nobody would maintain.
log "Reloading Caddy"
"${COMPOSE[@]}" exec -T caddy caddy reload --config /etc/caddy/Caddyfile \
  || printf 'WARNING: Caddy reload failed; the previous config is still live\n' >&2

# ── 6. Reclaim disk ─────────────────────────────────────────────────────────
# Images, and only images. `until=168h` keeps a week of previous builds so the
# manual rollback path in docs/CI_CD.md has something local to fall back to,
# and nothing referenced by a running container is ever a candidate — Postgres,
# Redis and Caddy are all safe by construction.
#
# Never `docker system prune --volumes` here, or anywhere on this box: the
# Postgres and Redis data live in named volumes, and one careless flag there is
# the actual disaster this whole pipeline is built to avoid.
log "Pruning images older than a week"
docker image prune -af --filter 'until=168h' >/dev/null

log "Deployed ${TAG}"
