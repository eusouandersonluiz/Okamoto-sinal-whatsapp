#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Apply schema via raw SQL migrations (idempotent, tracked in _migrations).
# NEVER use `drizzle-kit push` here: the schema mirrors the READ-ONLY
# whatsapp_messages source table, so push would try to drop its columns.
pnpm --filter @workspace/scripts run migrate
