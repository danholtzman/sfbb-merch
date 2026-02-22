# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.13.0
ARG PNPM_VERSION=10.30.2

# ── Stage 1: Build ────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder

# Use production node environment by default.
ENV NODE_ENV=production

# Install pnpm.
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@${PNPM_VERSION}

WORKDIR /app

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.local/share/pnpm/store to speed up subsequent builds.
# Leverage a bind mounts to package.json and pnpm-lock.yaml to avoid having to copy them into
# into this layer.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy the rest of the source files into the image.
COPY . .

RUN pnpm build

# ── Stage 2: Runtime ──────────────────────────────────────
ARG NODE_VERSION
ARG PNPM_VERSION

FROM node:${NODE_VERSION}-alpine AS runner

RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@${PNPM_VERSION}

WORKDIR /app

RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

# Expose the port that the application listens on.
EXPOSE 3000

# Run the application as a non-root user.
USER node

# Run the application.
CMD ["node", "dist/index.js"]
