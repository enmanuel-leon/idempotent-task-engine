FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

FROM nginxinc/nginx-unprivileged:alpine3.22 AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
