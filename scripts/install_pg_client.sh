#!/usr/bin/env bash
# Install postgresql-client-17 from the official PGDG repo on Ubuntu/Debian.
# Usage: sudo bash scripts/install_pg_client.sh

set -euo pipefail

echo "==> Installing prerequisites (curl, gnupg, lsb-release)"
apt-get install -y curl ca-certificates gnupg lsb-release

echo "==> Adding PostgreSQL PGDG apt repo"
install -d /usr/share/postgresql-common/pgdg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc

CODENAME="$(lsb_release -cs)"
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list

echo "==> apt-get update"
apt-get update

echo "==> Installing postgresql-client-17"
apt-get install -y postgresql-client-17

echo "==> Done. Version:"
psql --version
