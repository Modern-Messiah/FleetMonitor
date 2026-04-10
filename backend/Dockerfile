FROM node:20-alpine AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY backend backend
COPY frontend frontend

RUN pnpm install --filter backend... --no-frozen-lockfile
RUN pnpm --dir backend prisma generate --schema=prisma/schema.prisma
RUN pnpm --filter backend build

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN corepack enable

COPY --from=build /app /app

WORKDIR /app/backend

RUN pnpm prisma generate --schema=prisma/schema.prisma

EXPOSE 3000
CMD ["node", "dist/main.js"]
