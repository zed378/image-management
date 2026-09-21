# One Dockerfile for both deployables (ADR-017):
#
#   docker build -f deploy/Dockerfile --build-arg SERVICE=api    -t image-delivery-api .
#   docker build -f deploy/Dockerfile --build-arg SERVICE=worker -t image-delivery-worker .
#
# Build once, promote the same image across environments
# (docs/DEVOPS/01-CONTAINERIZATION.md); nothing environment-specific is baked in.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS build
ARG SERVICE
RUN test -n "$SERVICE" || (echo "SERVICE build-arg is required (api|worker)" && exit 1)
RUN corepack enable
WORKDIR /repo

# Manifests first, so dependency installation is cached across source edits.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services ./services
RUN pnpm install --frozen-lockfile

RUN pnpm --filter "@image-delivery/${SERVICE}" build
# A standalone production node_modules for this one service (native
# binaries such as sharp are resolved for the target platform here).
RUN pnpm --filter "@image-delivery/${SERVICE}" deploy --prod --legacy /out \
 && cp -r "services/${SERVICE}/dist" /out/dist

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
# No HEALTHCHECK here: orchestrators probe /healthz and /readyz directly.
CMD ["node", "--enable-source-maps", "dist/server.js"]
