#!/usr/bin/env bash
# Sets the Postgres GUCs that pg_net-based triggers and cron jobs depend on,
# against the local Supabase instance.
#
# Why this is a script and not part of seed.sql / a migration:
#   - ALTER DATABASE requires superuser privileges
#   - In Supabase local, `postgres` is NOT superuser; `supabase_admin` is
#   - `supabase db reset` connects as `postgres`, so it can't ALTER DATABASE
#   - We connect via TCP loopback inside the DB container, which uses `trust`
#     auth, allowing us to switch to `supabase_admin` without a password
#
# `supabase db reset` drops and recreates the `postgres` database, which wipes
# any prior `ALTER DATABASE` settings. Re-run this script after every reset.
# `pnpm supabase:reset` chains both commands together for you.
#
# Production: see docs/PRE_LAUNCH_RUNBOOK.md §2.3 — operator must run
# `ALTER DATABASE postgres SET app.supabase_url = '...';` manually.

set -euo pipefail

# Detect the local DB container name.
CONTAINER="$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_' | head -n 1)"

if [ -z "$CONTAINER" ]; then
  echo "Error: no running supabase_db_* container found." >&2
  echo "Run 'supabase start' first." >&2
  exit 1
fi

# Local Supabase CLI default service role JWT — the same key shipped to every
# developer running 'supabase start'. Only valid against the local instance.
LOCAL_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

# pg_net inside the local DB container reaches the local Edge Functions
# runtime via host.docker.internal, not 127.0.0.1.
LOCAL_SUPABASE_URL="http://host.docker.internal:54321"

echo "Setting Postgres GUCs on container $CONTAINER..."

# Use -c per statement instead of a heredoc — heredoc + docker exec without -i
# was silently dropping the second statement on this CLI version.
docker exec "$CONTAINER" psql -h 127.0.0.1 -U supabase_admin -d postgres \
  -v ON_ERROR_STOP=1 \
  -c "ALTER DATABASE postgres SET app.supabase_url = '$LOCAL_SUPABASE_URL';"

docker exec "$CONTAINER" psql -h 127.0.0.1 -U supabase_admin -d postgres \
  -v ON_ERROR_STOP=1 \
  -c "ALTER DATABASE postgres SET app.service_role_key = '$LOCAL_SERVICE_ROLE_KEY';"

# ALTER DATABASE only applies to NEW sessions, so verify in a fresh connection.
echo ""
echo "Verifying (fresh session)..."
docker exec "$CONTAINER" psql -h 127.0.0.1 -U supabase_admin -d postgres -c "SELECT * FROM verify_app_gucs();"

echo ""
echo "Done. GUCs persist across 'supabase db reset' but reset on container recreation."
