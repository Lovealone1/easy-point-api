#!/usr/bin/env bash
set -euo pipefail

# When invoked by cron, re-hydrate the env captured by entrypoint.sh at startup.
if [ -f /backup/env.sh ]; then
  # shellcheck disable=SC1091
  source /backup/env.sh
fi

: "${PGHOST:?PGHOST is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_S3_ACCESS_KEY_ID:?BACKUP_S3_ACCESS_KEY_ID is required}"
: "${BACKUP_S3_SECRET_ACCESS_KEY:?BACKUP_S3_SECRET_ACCESS_KEY is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required — this protects the only off-site copy of the database}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PREFIX="${BACKUP_S3_PREFIX:-postgres-backups}"
FILENAME="${PGDATABASE}_${TIMESTAMP}.sql.gz.enc"
TMP_DIR="$(mktemp -d)"
TMP_FILE="${TMP_DIR}/${FILENAME}"
trap 'rm -rf "${TMP_DIR}"' EXIT

echo "[backup] $(date -u +%FT%TZ) Starting backup of ${PGDATABASE}@${PGHOST}..."

# --no-owner/--no-privileges: role names differ between the source and any
# restore target, so we don't want ownership/grants baked into the dump.
pg_dump --no-owner --no-privileges \
  | gzip \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "pass:${BACKUP_ENCRYPTION_KEY}" -out "${TMP_FILE}"

export AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="${BACKUP_S3_REGION:-us-east-1}"

S3_ARGS=()
if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then
  S3_ARGS+=(--endpoint-url "${BACKUP_S3_ENDPOINT}")
fi

DEST="s3://${BACKUP_S3_BUCKET}/${PREFIX}/${FILENAME}"
aws "${S3_ARGS[@]}" s3 cp "${TMP_FILE}" "${DEST}"
echo "[backup] Uploaded ${DEST}"

# ── Prune backups older than the retention window ──────────────────────────
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
CUTOFF_ISO="$(date -u -d "-${RETENTION_DAYS} days" +%Y-%m-%dT%H:%M:%S)"

aws "${S3_ARGS[@]}" s3api list-objects-v2 \
  --bucket "${BACKUP_S3_BUCKET}" \
  --prefix "${PREFIX}/" \
  --query "Contents[?LastModified<='${CUTOFF_ISO}'].Key" \
  --output text 2>/dev/null \
  | tr '\t' '\n' \
  | while read -r KEY; do
      [ -z "${KEY}" ] && continue
      echo "[backup] Pruning expired backup: ${KEY}"
      aws "${S3_ARGS[@]}" s3 rm "s3://${BACKUP_S3_BUCKET}/${KEY}"
    done

echo "[backup] $(date -u +%FT%TZ) Done."
