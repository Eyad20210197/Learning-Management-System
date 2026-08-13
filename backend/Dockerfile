# syntax=docker/dockerfile:1.7
FROM node:24.15.0-bookworm-slim AS dependencies
WORKDIR /workspace/backend
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY backend ./
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
RUN npm run build

FROM node:24.15.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates dumb-init ffmpeg \
  && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /workspace/backend/dist ./dist
USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/apps/api/main.js"]

FROM postgres:17.6-bookworm AS maintenance
WORKDIR /workspace/backend
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates dumb-init \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local /usr/local
COPY --from=build /workspace/backend ./
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "db:migrate:deploy"]
