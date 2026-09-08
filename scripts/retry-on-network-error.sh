#!/usr/bin/env bash
# Retry a command ONLY when it failed for a transport reason.
#
#   usage: scripts/retry-on-network-error.sh <attempts> -- <command> [args...]
#
# WHY THIS EXISTS
# `deno check` over supabase/functions resolves ~100 remote modules from
# esm.sh, jsr.io, deno.land and the npm registry on every run. Every specifier
# in the repo is already pinned to an exact version, so this is not a version
# problem — it is that a single connection reset anywhere in that fan-out fails
# the whole job. It happened on 2026-09-08:
#
#   error: Import 'https://esm.sh/stripe@13.0.0/types/Customers.d.ts' failed.
#     0: error sending request for … (104.26.15.209:443):
#        client error (SendRequest): connection error: connection reset
#
# WHY NOT A LOCKFILE OR A CACHE — the obvious fixes, deliberately rejected.
# `.gitignore` explains that `supabase functions deploy` does NOT use
# deno.lock: the deployed runtime resolves specifiers itself. Locking or
# caching CI would make it green against versions production is not running, so
# the type-check would stop being an early warning that an upstream release
# broke a live function. That property is the whole point of the job, and it is
# worth more than the flake costs.
#
# So: keep resolving fresh, and retry the transport failure only.
#
# THE IMPORTANT PART IS WHAT IT DOES *NOT* RETRY. A real type error must fail on
# the first attempt — retrying it three times would turn a fast red into a slow
# red and, worse, invite someone to assume any red here is "just the flake
# again". The output must match a transport-level phrase, or this exits
# immediately with the command's own status.

set -uo pipefail

if [ "$#" -lt 3 ] || [ "$2" != "--" ]; then
  echo "usage: $0 <attempts> -- <command> [args...]" >&2
  exit 2
fi

attempts="$1"
shift 2

case "$attempts" in
  ''|*[!0-9]*) echo "attempts must be a positive integer, got '$attempts'" >&2; exit 2 ;;
esac
[ "$attempts" -ge 1 ] || { echo "attempts must be >= 1" >&2; exit 2; }

# Transport-level only. Note that "Import '…' failed" is NOT on this list by
# itself: Deno prints that for a 404 on a genuinely missing module too, and a
# missing module is a real failure that must not be retried. The accompanying
# connection phrase is what distinguishes them.
readonly NETWORK_RE='error sending request|connection error|connection reset|connection closed|connection refused|os error (54|60|104|110)|dns error|error trying to connect|operation timed out|Connection timed out|502 Bad Gateway|503 Service Unavailable|Temporary failure in name resolution'

out="$(mktemp)"
trap 'rm -f "$out"' EXIT

attempt=1
while true; do
  # The status MUST be captured in an else branch. `if cmd; then …; fi` with a
  # failing condition and no else returns 0, so reading `$?` after `fi` yields 0
  # and this script would exit successfully on a genuine failure — it did
  # exactly that in its first version, which would have turned a real type error
  # into a green build. Caught by asserting the exit code, not just the retry count.
  if "$@" >"$out" 2>&1; then
    cat "$out"
    [ "$attempt" -gt 1 ] && echo "(succeeded on attempt $attempt of $attempts)"
    exit 0
  else
    status=$?
  fi

  if [ "$attempt" -ge "$attempts" ] || ! grep -qE "$NETWORK_RE" "$out"; then
    cat "$out"
    if [ "$attempt" -gt 1 ]; then
      echo "::error::failed after $attempt attempt(s)."
    elif ! grep -qE "$NETWORK_RE" "$out"; then
      echo "(not a transport failure — not retried)"
    fi
    exit "$status"
  fi

  delay=$((attempt * 10))
  cat "$out"
  echo "::warning::attempt $attempt of $attempts failed on a network error; retrying in ${delay}s"
  sleep "$delay"
  attempt=$((attempt + 1))
done
