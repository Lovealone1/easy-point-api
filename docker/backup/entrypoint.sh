#!/usr/bin/env bash
set -euo pipefail

# cron jobs run in a clean environment, so the PG*/BACKUP_* vars this
# container was started with need to be captured now and re-sourced by
# backup.sh on every scheduled run. `declare -p` quotes values safely,
# which matters here since passwords/keys may contain shell metacharacters.
: > /backup/env.sh
for var_name in $(compgen -e | grep -E '^(PG|BACKUP_|AWS_)'); do
  declare -p "${var_name}" >> /backup/env.sh
done
chmod 600 /backup/env.sh

SCHEDULE="${BACKUP_SCHEDULE:-0 3 * * *}"
echo "${SCHEDULE} /backup/backup.sh >> /proc/1/fd/1 2>> /proc/1/fd/2" > /etc/crontabs/root

echo "[backup] Scheduled with cron expression: ${SCHEDULE}"
echo "[backup] Running an initial backup now to verify configuration..."
/backup/backup.sh || echo "[backup] WARNING: initial backup failed — check BACKUP_*/PG* configuration. Scheduled runs will retry."

exec crond -f -l 2
