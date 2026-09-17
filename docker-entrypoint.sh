#!/bin/bash

set -e

# Workaround: Docker's embedded DNS (127.0.0.11) can drop one of glibc's
# parallel A/AAAA queries, causing random "getaddrinfo EAI_AGAIN" on
# outbound calls. single-request-reopen forces sequential queries instead.
# Remove once Docker's embedded DNS handles this reliably, or if this
# service stops routing through it (e.g. host networking).
{
  if grep -q 'single-request-reopen' /etc/resolv.conf 2>/dev/null; then
    :
  elif grep -q '^options ' /etc/resolv.conf 2>/dev/null; then
    new="$(sed 's/^options .*/& single-request-reopen/' /etc/resolv.conf)"
    printf '%s\n' "$new" > /etc/resolv.conf
  else
    printf '%s\noptions single-request-reopen\n' "$(cat /etc/resolv.conf)" > /etc/resolv.conf
  fi
} || true  # best-effort; resolv.conf is a bind mount, rewrite via redirection, never `sed -i`

# Needs root to write resolv.conf above; drop to the app user before exec.
exec su node -c "exec $(printf '%q ' "$@")"
