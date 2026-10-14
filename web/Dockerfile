# Official multi-platform digest; builds are explicitly Linux/ARM64.
FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN groupadd --gid 10001 sfbb && useradd --uid 10001 --gid sfbb --no-create-home sfbb && mkdir /data && chown sfbb:sfbb /data

FROM base AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run build

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev --omit=peer

# Invoke this target only for private migration jobs, never as the web server.
FROM dependencies AS migration
COPY --chown=10001:10001 prisma.config.ts ./
COPY --chown=10001:10001 prisma ./prisma
COPY --chown=10001:10001 scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=build --chown=10001:10001 /app/src/generated/prisma ./src/generated/prisma
USER 10001:10001
CMD ["node", "scripts/migrate.mjs"]

FROM base AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=10001:10001 /app/.next/standalone ./
COPY --from=build --chown=10001:10001 /app/.next/static ./.next/static
# Native modules are rebuilt for Linux; migration CLI stays in the separate migration target.
COPY --from=production-dependencies --chown=10001:10001 /app/node_modules ./node_modules
COPY --from=build --chown=10001:10001 /app/src/generated/prisma ./src/generated/prisma
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
