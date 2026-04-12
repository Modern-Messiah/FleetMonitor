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
RUN cd backend && pnpm prisma generate --schema=prisma/schema.prisma
RUN pnpm --filter backend build

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN corepack enable

COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/backend /app/backend

WORKDIR /app/backend

RUN pnpm prisma generate --schema=prisma/schema.prisma

EXPOSE 3000
CMD ["sh", "-c", "pnpm prisma migrate deploy --schema=prisma/schema.prisma && node dist/main.js"]
