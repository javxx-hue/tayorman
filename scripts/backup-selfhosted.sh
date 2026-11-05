#!/usr/bin/env bash
# Backup of the database of a SELF-HOSTED Supabase (run on the server). The hosted Supabase free plan keeps no
# backups either; here nobody does it for you at all, so run this from cron and copy the files off the server.
#
#   scripts/backup-selfhosted.sh
#
# Settings (environment variables, all optional):
#   DB_CONTAINER  name of the Postgres container          (default supabase-db)
#   DB_USER       database user                           (default postgres)
#   DB_NAME       database                                (default postgres)
#   BACKUP_DIR    where the files go                      (default ./backups)
#   KEEP_DAYS     delete backups older than this          (default 14)
#
# One file holds everything in that database (public tables, accounts, storage records), in pg_dump's compact format.
# Restore with:  docker exec -i <container> pg_restore -U postgres -d postgres --clean --if-exists < backups/<file>.dump
# Files uploaded to Storage live in a Docker volume, not in the database: copy that folder as well (rsync).
# The files hold personal data: keep them private, and keep a copy somewhere that is not this server.
set -euo pipefail

CONTAINER="${DB_CONTAINER:-supabase-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
DIR="${BACKUP_DIR:-backups}"
KEEP="${KEEP_DAYS:-14}"

mkdir -p "$DIR"
FILE="$DIR/db-$(date +%Y-%m-%d-%H%M%S).dump"
# a failed run must not leave a half-written file that looks like a backup
trap 'rm -f "$FILE"' ERR

docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$FILE"

SIZE=$(wc -c < "$FILE" | tr -d ' ')
if [ "$SIZE" -lt 1024 ]; then
  echo "The backup is only $SIZE bytes: something is wrong (is the container name '$CONTAINER' right?)." >&2
  rm -f "$FILE"
  exit 1
fi

chmod 600 "$FILE"
find "$DIR" -maxdepth 1 -name 'db-*.dump' -mtime +"$KEEP" -delete
echo "Saved $FILE ($SIZE bytes). Backups older than $KEEP days are deleted."
