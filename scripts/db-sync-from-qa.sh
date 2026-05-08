#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-sync-from-qa.sh — Sync Railway QA Postgres → local Docker Postgres.
#
# Usage:
#   export RAILWAY_QA_DATABASE_URL="postgresql://USER:PASS@HOST:PORT/DB"
#   bash scripts/db-sync-from-qa.sh
#
# Requires:
#   - postgresql-client-15 on host (psql, pg_dump)
#   - Local Postgres running via docker compose (service "db", port 5432)
#   - Local .env or compose values matching: user=postgres, db=railway, pass=toor
#
# Safety:
#   - Confirms interactively before dropping/restoring local tables.
#   - Never writes to Railway.
#   - Stores timestamped dumps in dumps/ (gitignored).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colors ───────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
    RED=$'\033[0;31m'
    GREEN=$'\033[0;32m'
    YELLOW=$'\033[1;33m'
    BLUE=$'\033[0;34m'
    BOLD=$'\033[1m'
    NC=$'\033[0m'
else
    RED=""; GREEN=""; YELLOW=""; BLUE=""; BOLD=""; NC=""
fi

info()  { printf "%s==>%s %s\n" "$BLUE"   "$NC" "$*"; }
ok()    { printf "%s✓%s %s\n"  "$GREEN"  "$NC" "$*"; }
warn()  { printf "%s⚠%s %s\n"  "$YELLOW" "$NC" "$*"; }
fail()  { printf "%s✗%s %s\n"  "$RED"    "$NC" "$*" >&2; }

# ── Config (local target — Docker) ───────────────────────────────────────────
LOCAL_URL="${LOCAL_DATABASE_URL:-postgresql://postgres:toor@localhost:5432/railway}"
DUMPS_DIR="dumps"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DUMP_FILE="${DUMPS_DIR}/qa_${TIMESTAMP}.sql"

# ── Preflight ────────────────────────────────────────────────────────────────
info "Preflight checks"

if [ -z "${RAILWAY_QA_DATABASE_URL:-}" ]; then
    fail "RAILWAY_QA_DATABASE_URL is not set. Export it before running."
    printf "  e.g.  %sexport RAILWAY_QA_DATABASE_URL=\"postgresql://...\"%s\n" "$BOLD" "$NC"
    exit 1
fi

for bin in pg_dump psql; do
    if ! command -v "$bin" >/dev/null 2>&1; then
        fail "$bin not found on host. Install postgresql-client-15 first."
        exit 1
    fi
done

ok "pg_dump: $(pg_dump --version | head -1)"
ok "psql:    $(psql --version | head -1)"

# Verify local DB reachable
if ! psql "$LOCAL_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    fail "Cannot connect to local Postgres at $LOCAL_URL"
    fail "Is the db container up?  docker compose up -d db"
    exit 1
fi
ok "Local Postgres reachable"

mkdir -p "$DUMPS_DIR"

# ── Confirmation ─────────────────────────────────────────────────────────────
warn "This will OVERWRITE the local database with QA data."
printf "  Source (read):  %s%s%s\n"   "$BOLD" "(RAILWAY_QA_DATABASE_URL — hidden)" "$NC"
printf "  Target (write): %s%s%s\n"   "$BOLD" "$LOCAL_URL"                         "$NC"
printf "  Dump file:      %s%s%s\n\n" "$BOLD" "$DUMP_FILE"                         "$NC"

read -r -p "Type 'yes' to continue: " confirm
if [ "$confirm" != "yes" ]; then
    warn "Aborted by user."
    exit 0
fi

# ── Dump ─────────────────────────────────────────────────────────────────────
info "Dumping from Railway QA → $DUMP_FILE"
pg_dump \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    --format=plain \
    --dbname="$RAILWAY_QA_DATABASE_URL" \
    --file="$DUMP_FILE"

DUMP_SIZE="$(du -h "$DUMP_FILE" | awk '{print $1}')"
ok "Dump complete — size: $DUMP_SIZE"

# ── Restore ──────────────────────────────────────────────────────────────────
info "Restoring into local Postgres"
# ON_ERROR_STOP aborts on first SQL error.
psql \
    --variable ON_ERROR_STOP=1 \
    --dbname="$LOCAL_URL" \
    --file="$DUMP_FILE" \
    >/tmp/db-sync-restore.log 2>&1 \
    || { fail "Restore failed. See /tmp/db-sync-restore.log"; tail -30 /tmp/db-sync-restore.log; exit 1; }

ok "Restore complete"

# ── Verification ─────────────────────────────────────────────────────────────
info "Verifying restored schema"

TABLE_COUNT="$(psql "$LOCAL_URL" -At -c \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")"

DB_SIZE="$(psql "$LOCAL_URL" -At -c \
    "SELECT pg_size_pretty(pg_database_size(current_database()));")"

TOP_TABLES="$(psql "$LOCAL_URL" -At -F $'\t' -c \
    "SELECT schemaname||'.'||relname, n_live_tup
       FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
      LIMIT 5;")"

printf "\n%s┌─ Sync summary ─────────────────────────────────────%s\n" "$GREEN" "$NC"
printf "%s│%s Tables restored: %s%s%s\n" "$GREEN" "$NC" "$BOLD" "$TABLE_COUNT" "$NC"
printf "%s│%s Database size:   %s%s%s\n" "$GREEN" "$NC" "$BOLD" "$DB_SIZE"     "$NC"
printf "%s│%s Dump file:       %s%s%s (%s)\n" "$GREEN" "$NC" "$BOLD" "$DUMP_FILE" "$NC" "$DUMP_SIZE"
printf "%s│%s Top 5 tables by row count:\n" "$GREEN" "$NC"
while IFS=$'\t' read -r name rows; do
    [ -z "$name" ] && continue
    printf "%s│%s   %-45s %s%s%s\n" "$GREEN" "$NC" "$name" "$BOLD" "$rows" "$NC"
done <<< "$TOP_TABLES"
printf "%s└────────────────────────────────────────────────────%s\n\n" "$GREEN" "$NC"

ok "Sync complete."
