# 🚀 Easy Point API — Deployment Guide (VPS + Docker Compose)

This guide covers taking `easy-point-api` from a laptop to a production VPS: server sizing, secrets, the one-time migration off Supabase's database, first deploy, day-2 operations, and disaster recovery.

Stack: **Docker Compose** · **Caddy** (TLS + reverse proxy) · **PostgreSQL 17** (self-hosted) · **Redis** · **NestJS** (multi-stage image).

---

## 1. VPS sizing

Running Node + Postgres + Redis + Caddy on one box:

| Tier | Specs | Notes |
|---|---|---|
| Minimum | 2 vCPU / 2 GB RAM / 40 GB NVMe | Works, but tune Postgres down (`shared_buffers=256MB`) and watch swap. |
| **Recommended** | **2 vCPU / 4 GB RAM / 80 GB NVMe** | The defaults in `compose.prod.yaml` are sized for this. |
| Comfortable | 4 vCPU / 8 GB RAM | Headroom for growth without re-tuning. |

- OS: **Ubuntu 24.04 LTS**.
- **Pick the region by where your users are** — this is the single biggest latency lever you have. Hetzner (Europe) is the best price/performance if your users are European; DigitalOcean/Vultr (Miami, São Paulo) if they're in Latin America.
- Enable the provider's automated snapshots. This is your first line of defense against a dead disk — the off-site backups in §6 are the second line, not a replacement.

---

## 2. Server preparation (one time)

```bash
# As root, on a fresh VPS
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin ufw fail2ban

# Firewall: only SSH, HTTP, HTTPS
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp   # HTTP/3
ufw enable

# Non-root deploy user
adduser deploy
usermod -aG docker deploy
```

Point your domain's DNS `A`/`AAAA` record at the VPS IP before starting Caddy — it needs to resolve for the Let's Encrypt HTTP-01 challenge to succeed.

---

## 3. Generate secrets

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET   (must differ from JWT_SECRET)
openssl rand -base64 24   # POSTGRES_PASSWORD
openssl rand -base64 24   # REDIS_PASSWORD
openssl rand -base64 32   # BACKUP_ENCRYPTION_KEY
```

Copy `.env.example` to `.env` on the server and fill in:
- The five secrets above.
- `NODE_ENV=production`
- `CORS_ORIGINS` — your real frontend origin(s), comma-separated. No wildcards.
- `TRUST_PROXY=1` — Caddy is exactly one hop in front of the app in this topology.
- `API_BASE_URL` / `FRONTEND_URL` — must be `https://`.
- `DOMAIN` / `ACME_EMAIL` — for Caddy.
- `SMTP_*`, `S3_*` (Supabase Storage — kept as-is, only the database moved).
- `SUPABASE_URL` etc. — still required, they're used for Storage.

`DATABASE_URL` / `DIRECT_URL` in `.env` don't need to be correct — `compose.yaml`/`compose.prod.yaml` override both to point at the local `postgres` service automatically (same pattern the old dev compose used for `REDIS_HOST`). Leave `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` as the source of truth.

Validate before going further — this should fail loudly if anything's missing:
```bash
docker compose -f compose.yaml -f compose.prod.yaml config --quiet
```

---

## 4. One-time migration off Supabase's database

Only the database is moving — **Supabase Storage stays** as the file store, `SUPABASE_URL`/`S3_*` are unchanged.

1. **Freeze writes.** Stop whatever currently points at the Supabase database (put the old deployment in maintenance mode, or just stop it).
2. **Dump from Supabase**, using its `DIRECT_URL` (not the pooler):
   ```bash
   pg_dump "$SUPABASE_DIRECT_URL" \
     --schema=public --no-owner --no-privileges \
     -Fc -f easypoint.dump
   ```
   `--schema=public` matters — Supabase's database also has `auth`, `storage`, and extension schemas you don't want.
3. **Bring up just Postgres** on the new stack:
   ```bash
   docker compose -f compose.yaml -f compose.prod.yaml up -d postgres
   ```
4. **Restore** into the empty database:
   ```bash
   docker compose -f compose.yaml -f compose.prod.yaml exec -T postgres \
     pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges < easypoint.dump
   ```
5. **Verify migrations are recognized** — the dump includes Prisma's `_prisma_migrations` table, so this should report *up to date* with nothing to apply:
   ```bash
   docker compose -f compose.yaml -f compose.prod.yaml --profile migrate run --rm migrate pnpm exec prisma migrate status --schema=./prisma/schema.prisma
   ```
6. **Sanity-check row counts** against the source for the tables that matter most: `Sale`, `FinancialTransaction`, `Invoice`, `Subscription`, `AuditLog`.
7. Keep the old Supabase database around (read-only, or just don't delete it) for a few days as a fallback before decommissioning it.

---

## 4b. Rol de aplicación para RLS (obligatorio, una vez por entorno)

El aislamiento entre organizaciones lo impone **Row-Level Security de Postgres**, no la aplicación. Para que las políticas surtan efecto, la app **no puede conectarse como el dueño de las tablas** — Postgres exime al owner de las políticas RLS.

Por eso hay dos roles:

| Variable | Rol | Uso | Sujeto a RLS |
|---|---|---|---|
| `DATABASE_URL` | `easypoint_app` | La aplicación en runtime | **Sí** |
| `DIRECT_URL` | `easypoint` (owner) | Migraciones y seed | No |

La migración `enable_rls` crea `easypoint_app` **sin contraseña** a propósito: un secreto no debe vivir en un archivo versionado en git. Un rol `LOGIN` sin contraseña no puede autenticarse, así que el sistema **falla cerrado** hasta que ejecutes, una sola vez por entorno:

```bash
docker compose -f compose.yaml -f compose.prod.yaml exec postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "ALTER ROLE easypoint_app WITH PASSWORD '$POSTGRES_APP_PASSWORD';"
```

Usa exactamente el valor de `POSTGRES_APP_PASSWORD` de tu `.env`, o la API no podrá conectarse.

**Verificación obligatoria** — si esto no da los resultados esperados, RLS es puramente decorativo:

```bash
# 1. El rol de la app NO debe poder saltarse RLS
psql -U easypoint -d easypoint -c \
  "SELECT rolbypassrls FROM pg_roles WHERE rolname='easypoint_app';"
#    → debe devolver: f

# 2. El rol de la app NO debe ser dueño de las tablas
psql -U easypoint -d easypoint -c \
  "SELECT tableowner FROM pg_tables WHERE tablename='sales';"
#    → debe devolver: easypoint  (NO easypoint_app)

# 3. Prueba de fuego: SELECT sin WHERE, conectado como la app
psql -U easypoint_app -d easypoint -c "SELECT count(*) FROM sales;"
#    → debe devolver 0 (sin tenant fijado, no ve NADA — falla cerrado)

psql -U easypoint_app -d easypoint -c \
  "BEGIN; SELECT set_config('app.current_org_id','<UUID-org-A>',TRUE); SELECT count(*) FROM sales; COMMIT;"
#    → debe devolver SOLO las filas de la organización A
```

---

## 5. First deploy

> **Las migraciones se ejecutan siempre por el servicio `migrate`.** La imagen de
> producción **no incluye el CLI de Prisma** (son ~180 MB de herramientas de
> desarrollo); el servicio `migrate` usa la etapa `build`, que sí lo tiene.
> No intentes correr `prisma` dentro del contenedor de la API: no está.

```bash
cd /opt/easy-point-api   # wherever you cloned the repo
git pull

# Apply any pending migrations (also covers future deploys)
docker compose -f compose.yaml -f compose.prod.yaml --profile migrate run --rm migrate

# Build and start everything
docker compose -f compose.yaml -f compose.prod.yaml up -d --build

# Watch it come up
docker compose -f compose.yaml -f compose.prod.yaml logs -f easy-point-api caddy
```

Verify:
```bash
curl -f https://<your-domain>/api/v1/health
curl -f https://<your-domain>/api/v1/health/ready
```

`/api/v1/health/ready` checks Postgres and Redis connectivity and returns 503 if either is down — useful for uptime monitoring, separate from the plain liveness check Docker itself uses.

---

## 6. Backups — off-site, encrypted, automatic

The `postgres-backup` service (`docker/backup/`) runs on `BACKUP_SCHEDULE` (default: daily at 03:00 UTC), and on every container start:

```
pg_dump --no-owner --no-privileges | gzip | openssl enc -aes-256-cbc → uploaded to BACKUP_S3_BUCKET
```

Old backups beyond `BACKUP_RETENTION_DAYS` (default 14) are pruned automatically. By default it reuses the `S3_*` credentials (Supabase Storage); point `BACKUP_S3_*` at a different bucket/provider if you'd rather keep DB backups separate from app file storage — recommended once you have real customer data, since it means a single compromised bucket doesn't take out both.

**Before you trust this with real data, run the restore drill once:**

```bash
# 1. Download and decrypt a backup
aws s3 cp s3://$BACKUP_S3_BUCKET/postgres-backups/<file>.sql.gz.enc . \
  --endpoint-url "$BACKUP_S3_ENDPOINT"
openssl enc -d -aes-256-cbc -pbkdf2 -pass "pass:$BACKUP_ENCRYPTION_KEY" \
  -in <file>.sql.gz.enc | gunzip > restored.sql

# 2. Restore into a throwaway database and confirm the app boots against it
docker compose -f compose.yaml -f compose.prod.yaml exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE restore_test;"
docker compose -f compose.yaml -f compose.prod.yaml exec -T postgres \
  psql -U "$POSTGRES_USER" -d restore_test < restored.sql
```

A backup that has never been restored is a hypothesis, not a backup. Do this before go-live, and re-run it periodically.

---

## 7. Updates & rollback

```bash
git pull
docker compose -f compose.yaml -f compose.prod.yaml --profile migrate run --rm migrate
docker compose -f compose.yaml -f compose.prod.yaml up -d --build easy-point-api
```

Prisma migrations are additive/forward-only by default — if a deploy needs to be rolled back, `git checkout` the previous commit and rebuild; only reach for a down-migration if the schema change itself needs reverting (rare, and should be a hand-written migration, not `prisma migrate reset`).

---

## 8. Post-deploy checklist

- [ ] `curl https://<domain>/api/v1/health/ready` returns `200`.
- [ ] `curl https://<domain>/api/swagger` returns `404` (Swagger is disabled by default in production — see `SWAGGER_ENABLED` in `.env.example` if you need it temporarily).
- [ ] `curl -X POST https://<domain>/api/v1/development/otp` returns `404` (dev-only routes don't exist outside `NODE_ENV=development`).
- [ ] A request with an unlisted `Origin` header is rejected by CORS; the real frontend origin is accepted.
- [ ] `docker compose -f compose.yaml -f compose.prod.yaml ps` shows every service `healthy`.
- [ ] The restore drill in §6 has been run at least once.
- [ ] Las tres verificaciones de RLS de §4b pasan (`rolbypassrls = f`, la app no es owner, y un `SELECT` sin `WHERE` devuelve 0 filas sin tenant fijado).
- [ ] `RATE_LIMIT_ENABLED` — decide on/off deliberately (see the note in `docs/SECURITY.md`); don't leave it at whatever the default happened to be.
- [ ] DNS, provider snapshots, and `ufw status` all confirmed.
