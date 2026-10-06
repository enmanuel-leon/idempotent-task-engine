# Environment Variables Architecture and Precedence

This document defines the environment variable structure, hierarchy, and scoping rules for the Idempotent Task Engine.

---

## 1. Precedence Hierarchy

When the same variable is defined across multiple sources, the following order of precedence applies from highest to lowest priority:

1. **System & OS / Container Process Variables** (`process.env`, Kubernetes Secrets/ConfigMaps, Docker runtime) **[Highest Priority]**
2. **Application-Specific `.env`** (`apps/api/.env` or `apps/web/.env`)
3. **Monorepo Root `.env`** (`/.env`)
4. **Code Defaults & Fallbacks** (`env.ts` / Zod defaults) **[Lowest Priority]**

For example, if `PORT` is defined in both `/.env` and `apps/api/.env`, the value in `apps/api/.env` wins. Any value injected directly into the process environment (e.g., `PORT=3100 pnpm dev`) overrides all file-based configurations.

Environment loaders preserve existing variables in `process.env` and never overwrite values injected by the operating system, Docker, CI, or Kubernetes.

---

## 2. File Responsibilities & Scoping

- **Root `.env`**: Shared local infrastructure values consumed by Docker Compose (e.g., PostgreSQL container credentials and Redis port mappings).
- **`apps/api/.env`**: Backend Fastify runtime settings, database connection with strict schema isolation, Redis connection, and HTTP gateway bindings.
- **`apps/web/.env`**: Frontend Vite client settings. Only variables prefixed with `VITE_` are exposed to the browser.

---

## 3. Supported Environment Variables Matrix

### Backend (`apps/api/.env`)

| Variable | Type | Default Value | Required | Purpose |
| :--- | :--- | :--- | :---: | :--- |
| `NODE_ENV` | `enum` | `development` | No | Runtime mode (`development`, `production`, `test`). |
| `PORT` | `number` | `3100` | No | Fastify HTTP server listener port. |
| `HOST` | `string` | `0.0.0.0` | No | Network interface IP address to bind. |
| `CORS_ORIGIN` | `string` | `http://localhost:5180,http://127.0.0.1:5180` | No | Comma-separated list of permitted browser origins. |
| `DATABASE_URL` | `string` | _(Must be provided)_ | **Yes** | PostgreSQL connection URI. **Must include `?schema=task_engine`**. |
| `REDIS_URL` | `string` | `redis://127.0.0.1:6379` | No | Redis 7 connection string for locks, queues, and cache. |

### Frontend (`apps/web/.env`)

| Variable | Type | Default Value | Required | Purpose |
| :--- | :--- | :--- | :---: | :--- |
| `VITE_API_URL` | `string` | `""` (Empty in dev) | No | Target API URL. Leave empty in development to use Vite's built-in reverse proxy (`/api`), avoiding cross-origin issues. |

---

## 4. PostgreSQL Schema Isolation Invariant

The `DATABASE_URL` variable **must** specify the schema query parameter:

```env
DATABASE_URL=postgresql://root:root@192.168.1.136:5434/app_template_db?schema=task_engine
```

Omitting `?schema=task_engine` will cause Prisma to target the `public` schema, violating the multi-tenant isolation invariant.

---

## 5. Runtime vs. Build-Time Evaluation

- **Backend (`apps/api`)**: Evaluated dynamically at **runtime** on application startup and request processing.
- **Frontend (`apps/web`)**: Evaluated at **build-time** by Vite (`pnpm build`). `VITE_*` variables are statically replaced in JavaScript bundles during compilation. For production deployments, ensure `VITE_API_URL` is set before invoking the build command.
