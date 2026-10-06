FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile
RUN pnpm --filter api build

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules

USER node

EXPOSE 3100

CMD ["node", "apps/api/dist/server.js"]
