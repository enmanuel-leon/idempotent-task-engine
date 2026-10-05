# Environment Variables Architecture and Precedence

## Precedence Rules

When the same variable is provided by more than one source, the following order applies from highest to lowest priority:

1. **System & OS / Container Process Variables** (`process.env`, Kubernetes Secrets/ConfigMaps, Docker) **[Highest Priority]**
2. **Application-Specific `.env`** (`apps/api/.env` or `apps/web/.env`)
3. **Monorepo Root `.env`** (`/.env`)
4. **Code Defaults & Fallbacks** (`env.ts` / Zod defaults) **[Lowest Priority]**

For example, if `DATABASE_URL` exists in both `.env` and `apps/api/.env`, the API-specific value must win. A process variable such as `DATABASE_URL=... pnpm dev` must win over both files.

Environment loaders must preserve variables that already exist in `process.env`. Loading an `.env` file must not overwrite values injected by the operating system, Docker, CI, or Kubernetes.

## File Responsibilities

Use each file for a specific scope:

- **Root `.env`**: Shared local infrastructure values consumed by Docker Compose, such as PostgreSQL, Redis, and MinIO settings.
- **`apps/api/.env`**: Backend runtime values, including database, Redis, authentication, storage, email, and server settings.
- **`SEED_ADMIN_EMAIL`**: Optional seed administrator email. The interactive CLI prompts for it when unset and defaults to `admin@example.com`.
- **`SEED_ADMIN_PASSWORD`**: Optional seed administrator password. The interactive CLI prompts for it when unset; non-interactive runs must provide it when creating the administrator. It must contain between 8 and 128 characters and must never be committed.
- **`apps/web/.env`**: Frontend build-time values. Only variables prefixed with `VITE_` are eligible for exposure in the browser.

The root `.env` is not a secure secret store. Do not place backend secrets there unless the file is only consumed by a trusted backend or infrastructure process.

## Application Loading Behavior

The API loads its application environment file from the API working directory. The root `.env` is currently used directly by Docker Compose and is not automatically merged into every application process.

If a future loader reads both the root and application files, it must use this order:

1. Load the root `.env` as the shared fallback.
2. Load the application `.env` as the app-specific override.
3. Restore existing `process.env` values so system and container variables remain authoritative.

This makes the application file more specific than the root file without exposing backend configuration to the frontend.

---

## Local Development Strategy

- Keep server configuration inside `apps/api/.env` and web configuration in `apps/web/.env`.
- Root `/.env` is read by Docker Compose (`pnpm infra:up`) for local PostgreSQL, Redis, and MinIO infrastructure.

---

## Production Deployment Strategy

- **Never commit `.env` files to Git**.
- Production variables are injected directly into container memory via Kubernetes ConfigMaps (`k8s/configmap.yaml`) and Secrets (`k8s/secrets.yaml`).

---

## Vite Frontend (`VITE_*`) Build-Time Injection

- **Backend (`apps/api`)**: Evaluates `process.env` dynamically at **runtime** on every HTTP request.
- **Frontend (`apps/web`)**: Vite replaces `VITE_*` variables at **compile time** (`pnpm build`). Pass `VITE_API_URL` during the container image build phase.
