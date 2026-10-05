# CLAUDE.md — AI Agent Context & Quick Reference Guide

This repository is a production-ready fullstack monorepo template built with Node 24, Fastify 5, React 19, Vite 8, Prisma 7, Better Auth, Redis, and Tailwind CSS v4.

---

## 🚀 Primary Commands

- `pnpm dev` — Start development servers for API & Web via Turborepo (`http://localhost:5173`)
- `pnpm cli` — Interactive SRE & Developer CLI console (Clack) for DB, Redis, SMTP test, and Docker management
- `pnpm check` — Run format check (`oxfmt --check`), oxlint, typecheck, and vitest suite
- `pnpm prepush:verify` — Full pre-push verification (format, lint, typecheck, tests, build)
- `pnpm --filter api test:coverage` — Run Vitest suite with V8 LCOV code coverage
- `pnpm knip` — Scan for dead code, unused exports, and unlisted dependencies
- `pnpm audit` — Verify CVE and security advisory status
- `pnpm infra:up` — Spin up local Postgres, Redis, and MinIO Docker containers
- `pnpm db:push` — Push Prisma schema updates directly to database
- `pnpm db:migrate:dev` — Create and apply local Prisma schema migration
- `pnpm db:migrate:deploy` — Apply pending migrations in staging/production
- `pnpm db:seed` — Seed countries, timezones, and reference data
- `pnpm clean:reset` — Wipe local Docker volumes, recreate database, push schema & seed

---

## 🛠️ Code Style & Architectural Guidelines

### 1. The "NO Ternary Operators" Rule (Strictly Enforced)

- Ternary expressions (`condition ? a : b`) are forbidden in all `.ts`, `.tsx`, and `.py` files.
- In logic files (`.ts`): Use explicit `if/else` control flow blocks with early returns.
- In React render blocks (`.tsx`): Pre-calculate conditional layouts into local variables before the `return` statement, or use safe boolean `&&` guards.
- For CSS classes: Always use `cn("base", isActive && "active-style")`.

### 2. NO Emojis in UI Components

- Raw unicode emojis (e.g. ◈, ⚡, 🚀, 🌐) are strictly prohibited in React UI components (`.tsx`).
- Always use Lucide React vector SVG icons (e.g. `<Sparkles />`, `<Building2 />`, `<Layers />`, `<Globe />`).

### 3. NO Commercial Trade Names

- Do not hardcode real commercial company or service names in templates, input placeholders, or translation JSONs.
- Use generic placeholders (e.g. "Jane Doe", "Example Corp", "App Template", "Storage Provider").

### 4. NO Magic Strings (Centralized Constants)

- Do not use hardcoded string literals for statuses, roles, storage providers, or event names.
- Always define domain string values inside `as const` constant objects or TypeScript enums in centralized `constants/` files (`src/constants/*.constants.ts`) and import them at call sites.

### 5. SonarLint & Cognitive Complexity (≤ 15)

- Keep function cognitive complexity ≤ 15 by decomposing logic into single-responsibility helpers.
- Never exceed 7 positional parameters (S107). When 4+ parameters are needed, bundle them into a typed parameter object: `function execute(params: Readonly<ExecuteParams>)`.
- Prefer optional chaining (`?.`) and nullish coalescing (`??`) over chained `&&` checks.
- Flatten indentation with early returns; do not duplicate branch bodies (S1871 / S3923).
- In tests, use `expect(arr).toHaveLength(n)` rather than `expect(arr.length).toBe(n)`.

### 6. Financial Precision: Integer Cents Standard

- All prices, balances, and transaction amounts are stored and transmitted as **integer cents (`priceCents`, `balanceCents`)**.
- Floating-point numbers (`float`, `double`) are banned for currency. The frontend divides by 100 (`cents / 100`) strictly at the presentation boundary.

### 7. Operational Encapsulation: No Inline Scripts

- Inline execution scripts (`node -e`, `tsx -e`) are strictly prohibited in documentation or operational tasks.
- Implement administrative, diagnostic, or seeding tasks as first-class typed CLI commands in `pnpm cli`.

### 8. Server-Side Pagination Standard

- **Mandatory Server-Side Pagination:** All API listing endpoints for collections that grow over
  time (e.g., items, audit logs, members, invitation history, transactions) MUST implement
  server-side pagination via `page` (default: 1) and `pageSize` (default: 10, max: 50) querystring
  parameters.
- **Response Envelope:** Responses MUST return the standardized payload structure:
  `{ data: T[], pagination: { total, page, pageSize, totalPages } }`.
- **Ban on Client-Side Slicing:** Client-side memory slicing on unbounded queries is strictly
  prohibited.
- **Fastify & Prisma Implementation:** Fastify routes and Prisma queries must leverage
  `skip: (page - 1) * pageSize` and `take: pageSize`, along with a concurrent
  `prisma.<model>.count` query.

### 9. Frontend SPA & React Conventions

- **Custom Hook Separation:** Split pages into `page-name.tsx` (JSX presentation), `use-page-name.ts` (state/handlers hook), and `index.ts` (barrel export).
- **Readonly Component Props (S6759):** Type functional component props as `Readonly<Props>`.
- **No Inline Sub-Components (S6478):** Never define sub-components inside parent components.
- **Native Interactive Elements (S6848 / S1082):** Never attach `onClick` to `div` or `span`. Use `<button>` components.
- **Predefined Stable IDs for Skeleton Keys (S6479):** Never use array `index` as React list keys.
- **No Native Dialogs:** Never use `window.confirm`, `window.alert`, or `window.prompt`. Use modal dialogs.
- **Table Polling Ban & Server-Side Pagination:** Polling loops (`refetchInterval`, `setInterval`)
  are prohibited on data tables. Tables for unbounded collections must consume server-side
  paginated endpoints. Implement explicit manual reload buttons with visual loading indicators.
- **Data Caching & Transitions:** Use `staleTime` and `placeholderData: keepPreviousData` in TanStack Query.
- **Heavy Computation Memoization:** Memoize diffs, summaries, and transformations with `useMemo` and `useCallback`.
- **Internationalization (i18n):** All client-facing UI text must use `useTranslation()` from `react-i18next`.
- **Stacked ID Display:** Render organization/tenant UUIDs directly underneath the name using a vertical `flex flex-col` layout with font-mono text (`font-mono text-[10px] opacity-60`).
- **Auth & Passkey Isolation:** WebAuthn passkeys are managed exclusively in authenticated `SettingsPage`. Accessing `/login` or `/register` with an active session redirects to `/`.
- **Tailwind CSS v4:** Use canonical Tailwind v4 utilities (`bg-linear-to-r` instead of `bg-gradient-to-r`).

### 10. Database Architecture & Migrations

- Schemas are managed exclusively via **Prisma Migrate** (`apps/api/prisma/migrations/`).
- Local migrations: `pnpm db:migrate:dev`. Production deployments: `pnpm db:migrate:deploy`.
- All SQL migrations must use idempotent guards (`IF NOT EXISTS`, `IF EXISTS`).

### 11. Environment Variable Priority & Precedence

- **Precedence Hierarchy:** System OS / Process (`process.env`, K8s) > App `.env` (`apps/api/.env`) > Root `/.env` > Code Defaults.
- **Local Dev:** Use `apps/api/.env` and `apps/web/.env`. Never commit `.env` files to Git.
- **Vite Client (`VITE_*`):** Evaluated and bundled at build-time (`pnpm build`).

### 12. Git & Commit Protocol

- **Conventional Commits:** Use `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- **Strict Line Length (100-char max):** Wrap commit headers and every line in body to <= 100 characters.
- **Mandatory User Approval Before Git Operations:** AI Agents MUST NOT run `git add`, `git commit`, `git push`, `git tag`, `git merge`, `git rebase`, or branch deletion commands without explicit authorization for that exact operation.
- Commit authorization does not authorize pushing. Never amend commits, force-push, skip hooks, or change Git configuration unless explicitly requested.
- Before an authorized commit, inspect `git status`, `git diff`, `git diff --cached`, and `git log --oneline -10`.
- Stage only intended files. Never stage secrets, `.env` files, generated output, or unrelated user changes.
- Keep unrelated concerns in separate commits and report the commit hash and included files after committing.

---

## 13. Closing Checklist for AI Agents

Before declaring any task complete, verify:

- [ ] No ternary operators (`? :`) introduced anywhere in `.ts`, `.tsx`, or `.py`.
- [ ] No raw emojis in UI components; Lucide React icons used exclusively.
- [ ] No commercial trade names hardcoded in code, placeholders, or translations.
- [ ] No hardcoded magic strings; domain values placed in `as const` or enums.
- [ ] All functions maintain Cognitive Complexity ≤ 15; parameter counts ≤ 7.
- [ ] Currency values strictly maintained as integer cents (`priceCents`, `balanceCents`).
- [ ] Server-side pagination enforced for unbounded collections; client-side slicing banned.
- [ ] Table polling banned; manual refresh button implemented with visual loading state.
- [ ] React functional component props typed with `Readonly<Props>`.
- [ ] Database changes managed exclusively via Prisma Migrate (`apps/api/prisma/migrations/`).
- [ ] Verification command suite executed and 100% green (`pnpm check`, `pnpm audit`, `pnpm knip`).
- [ ] Mandatory User Approval obtained before executing `git commit` or `git push`.
