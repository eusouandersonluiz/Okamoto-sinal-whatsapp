# syntax=docker/dockerfile:1

# ── build stage ──────────────────────────────────────────────────────────────
# Fresh install on the target platform resolves the correct native binaries
# (Vite/Tailwind/lightningcss/rollup) — no per-platform overrides needed.
FROM oven/bun:1.2.10 AS build
WORKDIR /app

COPY . .
RUN bun install --frozen-lockfile

# Vite reads PORT/BASE_PATH at config load; BASE_PATH=/ serves the web at root.
ENV NODE_ENV=production
ENV PORT=8080
ENV BASE_PATH=/
RUN bun run --filter @workspace/sinal-web build \
 && bun run --filter @workspace/api-server build

# ── runtime stage ────────────────────────────────────────────────────────────
# The API bundle (esbuild) is self-contained plus its pino worker files; it also
# serves the built web app, so the whole product runs as one Bun process.
FROM oven/bun:1.2.10-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV WEB_DIST=/app/web

COPY --from=build /app/artifacts/api-server/dist ./api
COPY --from=build /app/artifacts/sinal-web/dist/public ./web

EXPOSE 8080
CMD ["bun", "api/index.mjs"]
