# AGENTS.md — Fullstack Monorepo Engineering Standards

Welcome, AI Coding Agent! This document contains the normative engineering standards, architectural boundaries, and non-negotiable quality guardrails for this production-ready fullstack monorepo template.

Read this document before executing any code modifications. These rules are enforced in automated CI quality gates and SonarLint scans.

---

## 1. Project Overview & Architecture

### 1.1 Scope & System Boundary

Fullstack monorepo template built with modern web technologies, strict type safety, and microservice-ready architecture.

- **Primary Language/Runtime:** TypeScript 7 on Node.js 24 (ESM native)
- **Package Manager:** pnpm 11 (Workspace with catalog and overrides)
- **Framework & Libraries:** Fastify 5 (API), React 19 + Vite 8 (SPA Client)
- **Authentication:** Better Auth (with Passkey / WebAuthn, Organization, Admin plugins)
- **Database & Storage:** PostgreSQL 17 + Prisma 7 (Adapter-pg), S3-compatible Object Storage (MinIO / AWS S3)
- **Cache & Rate-Limiting:** Redis 7 (ioredis)
- **Operational CLI:** Interactive SRE & Developer console (`pnpm cli`)
- **Code Graph Intelligence:** In repositories indexed by CodeGraph (`.codegraph/` exists), consult it before reading or searching files.

### 1.2 Directory Layout

```
monorepo-template/
├── apps/
│   ├── api/                  # Fastify 5 backend application
│   │   ├── prisma/           # Prisma schema, migrations, and seeds
│   │   ├── src/
│   │   │   ├── config/       # Centralized configuration and env validation
│   │   │   ├── controllers/  # Route handlers and input mapping
│   │   │   ├── routes/       # API routes registration (versioned /api/v1)
│   │   │   ├── services/     # Domain business logic and storage providers
│   │   │   ├── constants/    # Centralized 'as const' values and domain enums
│   │   │   └── lib/          # Prisma, Redis, and Better Auth client instances
│   │   └── tests/            # Vitest backend test suites
│   └── web/                  # React 19 + Vite 8 SPA client
│       ├── src/
│       │   ├── components/   # Shared UI components (Lucide React icons only)
│       │   ├── pages/        # Custom hook pattern pages (presentation + hook)
│       │   ├── locales/      # i18next translation catalogs (en.json, es.json)
│       │   └── lib/          # API client, auth client, query client
├── packages/
│   └── config-typescript/    # Shared TypeScript configurations
├── docker/                   # Docker Compose stacks (development and production)
└── scripts/                  # Encapsulated automation scripts
```

---

## 2. Universal Guardrails & Non-Negotiable Standards

These standards apply to **all code modifications** without exception.

### 2.1 Mandatory Git Approval Protocol

AI coding agents are strictly **prohibited** from running `git add`, `git commit`, `git push`, `git tag`, `git merge`, `git rebase`, or branch deletion commands autonomously.

1. The agent must first inspect `git status`, `git diff`, `git diff --cached`, and `git log --oneline -10`.
2. Formulate the proposed branch name, staged files, and English Conventional Commit message.
3. Present these to the user and request explicit confirmation.
4. Only upon receiving explicit user consent may `git commit` or `git push` be executed. Commit authorization and push authorization are strictly separate.

### 2.2 Conventional Commits & 100-Character Max Line Length

- All commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `perf:`).
- **Strict Line Length Invariant (`body-max-line-length`):** The header, summary, and **every single line in the body and footer** MUST NOT exceed **100 characters**.
- All bullet points and descriptions must be manually wrapped to remain strictly below 100 characters per line.

### 2.3 Absolute Ban on Ternary Operators

Ternary expressions (`condition ? a : b`) are **strictly prohibited** across all `.ts`, `.tsx`, and `.py` files.

- **In logic files (`.ts`, `.py`):** Use standard `if/else` control flow blocks with clean, early returns.
- **In UI render blocks (`.tsx`):** Pre-calculate render branches inside local helper variables before the `return` statement, or use safe boolean `&&` logical guards.
- **In conditional styling:** Always use class merger utilities like `cn("base", isActive && "active-style")`.

### 2.4 Prohibition of Magic Strings

Hardcoded magic string literals for domain entities, notification types, statuses, roles, event names, or storage keys are strictly banned.

- In TypeScript: Define domain values inside centralized `as const` objects or TypeScript enums in centralized files (`src/constants/*.constants.ts`) and import them at call sites.

### 2.5 SonarLint Quality & Cognitive Complexity (≤ 15)

All functions must maintain a Sonar Cognitive Complexity score of **15 or lower**.

- **Clean Decomposition:** Break down orchestrators into discrete single-responsibility helper functions.
- **Cognitive Complexity Reduction Protocol:**
  - Coordinators and orchestrator functions must remain linear with Cognitive Complexity ≤ 5.
  - Extract workload item execution, metric summarization, ledger verification, dataset generation,
    and statistical calculations into discrete single-responsibility helper functions.
  - Avoid deeply nested conditionals and multi-branch logic inside main loops or async handlers.
- **Parameter Bundling (≤ 7 parameters - S107):** Functions must never accept more than 7 positional parameters. When 4+ parameters are needed, bundle them into a typed parameter object: `function execute(params: Readonly<ExecuteParams>)`.
- **Optional Chaining (`?.`) & Nullish Coalescing (`??`):** Replace chained `&&` property checks with optional chaining (`a?.b === 'c'`).
- **Early Returns:** Flatten indentation by validating preconditions and edge cases upfront.
- **No Duplicate Branch Bodies (S1871 / S3923):** Never duplicate identical code blocks across `if` and `else if` branches; combine predicates or extract a shared helper.
- **No Redundant Union Types:** Do not pair bare `string` with string literal unions (e.g., `"draft" | "published" | string` collapses to `string`). Use `"draft" | "published" | (string & {})` if arbitrary strings must be permitted.
- **No Redundant `undefined` in Optional Properties:** When declaring an optional property with `?`, omit `| undefined` (write `version?: number | string`, NOT `version?: number | string | undefined`).
- **Assertion Standards:** In test suites, use `expect(arr).toHaveLength(n)` rather than `expect(arr.length).toBe(n)`.

### 2.6 Financial Precision: Integer Cents Standard

- **Integer Cents Invariant:** All prices, balances, and financial transaction amounts are stored and transmitted as **integer cents (`priceCents`, `balanceCents`)**.
- **Floating-point types (`float`, `double`) are banned for currency:** Database schemas use `INTEGER` or `BIGINT` for cents and `DECIMAL` for micro-metering.
- **UI Boundary Division:** The frontend divides integer cents by 100 (`cents / 100`) strictly at the presentation boundary when formatting localized currency strings.

### 2.7 Operational Encapsulation: Strict Ban on Inline Scripts

- **No Inline Execution Scripts (`tsx -e` / `node -e`):** Inline execution scripts are strictly prohibited in documentation, guides, or operational tasks.
- **First-Class CLI Commands:** All administrative, seeding, database verification, and diagnostic tasks must be implemented as first-class typed CLI commands executable via `pnpm cli` or dedicated npm scripts.

### 2.8 UI Hygiene & Trade Names

- **NO Emojis in UI Components:** Raw unicode emojis (e.g. ◈, ⚡, 🚀, 🌐) are strictly prohibited in `.tsx` components. Always use Lucide React vector SVG icons (e.g. `<Sparkles />`, `<Building2 />`, `<Layers />`, `<Globe />`).
- **NO Commercial Trade Names:** Do not hardcode real commercial company or service names in templates, input placeholders, or translation JSONs. Use generic placeholders (e.g. "Jane Doe", "Example Corp", "App Template", "Storage Provider").
- **Stacked ID Display Rule:** Render organization/tenant UUIDs directly underneath the name using a vertical `flex flex-col` layout with font-mono text (`font-mono text-[10px] opacity-60`).

### 2.9 Environment Variable Hierarchy & Precedence

- **Priority Order:** System OS / Process Environment (`process.env`, K8s Secrets/ConfigMaps) > App `.env` (`apps/api/.env`) > Root Monorepo `/.env` > Code Defaults.
- **Local Dev:** Keep environment variables inside `apps/api/.env` and `apps/web/.env`. Never commit `.env` files to Git.
- **Vite Client (`VITE_*`):** Variables are compiled at build-time (`pnpm build`).

### 2.10 English Documentation Policy

All code comments, commit messages, JSDoc, and markdown documentation MUST be written in English.

### 2.11 SemVer & User-Centric CHANGELOG Governance

Every change carries a versioning consequence that must be recorded before completing the work:

1. **User Consultation:** Ask the user which SemVer level applies (MAJOR / MINOR / PATCH). Never decide autonomously.
2. **Version Bump:** Bump the version in root `package.json` and affected workspace packages.
3. **User-Centric CHANGELOG:** Add a `CHANGELOG.md` entry explaining _what_ changed from a user/consumer perspective, not internal code mechanics.
4. **Contract Breaking = ALWAYS MAJOR:** Breaking a shared payload, an internal API, or an environment variable is automatically a MAJOR version bump.

### 2.12 Server-Side Pagination Standard

All list endpoints for collections that can grow over time (such as items, audit logs,
members, invitation history, transactions, etc.) MUST implement server-side pagination:

- **Query Parameters:** Endpoints must accept `page` (default: 1) and `pageSize` (default: 10,
  maximum: 50) querystring parameters.
- **Response Envelope:** Responses MUST return the standardized payload structure:
  ```ts
  { data: T[], pagination: { total: number, page: number, pageSize: number, totalPages: number } }
  ```
- **Ban on Client-Side Slicing:** Client-side pagination (fetching all records from the database
  or API to slice in memory) is STRICTLY PROHIBITED for unbounded datasets.
- **Prisma Query Standard:** Database queries must execute concurrently with total count
  retrieval: `skip: (page - 1) * pageSize`, `take: pageSize`, alongside
  `prisma.<model>.count({ where })`.

### 2.13 Living Documentation & Knowledge Maintenance Standards (OpenWiki Paradigm)

Documentation in this repository is treated as living code and must never drift from code state:

1. **Passive Synchronization:** Whenever an engineer or AI agent creates, modifies, or deletes an
   API route endpoint, Prisma database model, Redis prefix, or BullMQ worker queue, the
   corresponding architecture specification in `docs/` MUST be updated in the same changeset.
2. **Visual Documentation Standard (Native Mermaid Requirement):**
   - Every asynchronous, concurrent, or multi-service distributed flow MUST be accompanied by a
     native GitHub-rendered Mermaid diagram (`sequenceDiagram`, `stateDiagram-v2`, `flowchart`).
   - Pure text descriptions of complex temporal interactions (locks, pub/sub, queues) without a
     supporting diagram are strictly prohibited.
3. **Standardized Architecture Spec Layout:**
   All markdown documents under `docs/` must follow the standardized format:
   - **Prerequisites & Port/Protocol Matrix:** Target endpoints, URIs, and schema namespaces.
   - **Visual Diagrams:** Native GitHub-compatible Mermaid sequence, state, or component charts.
   - **Mathematical / State Invariants:** Formal equations and guarantees.
   - **Error Codes Matrix:** HTTP statuses mapped to machine-readable string constants.
   - **Operational Runbooks:** Explicit diagnostic commands and incident recovery steps.

### 2.14 Cryptographic Randomness & PRNG Standards

- **Strict Ban on `Math.random()`:** `Math.random()` is strictly prohibited across all production,
  benchmark, worker, script, and client code due to predictability and non-uniform distribution.
- **Node.js Cryptographic PRNG:** All backend services, queue workers, scripts, and benchmark
  harnesses must use `randomInt` or `randomUUID` imported from `'node:crypto'`.
- **Browser / Web Cryptographic PRNG:** Frontend React hooks and utility modules must use the
  standard Web Crypto API (`crypto.randomUUID()`, `crypto.getRandomValues()`).
- **Fisher-Yates Shuffle Invariant:** Array shuffling must implement an in-place Fisher-Yates
  algorithm using cryptographic entropy (`randomInt(0, i + 1)` in Node.js,
  `crypto.getRandomValues()` in browser). Naive `sort(() => Math.random() - 0.5)`
  is strictly banned.

### 2.15 Modern ESM & Top-Level Await Standards

- **Top-Level Await Invariant:** Standalone ESM scripts (`benchmarks/*.ts`, `scripts/*.ts`,
  `prisma/seed.ts`) must use top-level `await` wrapped in `try/catch/finally` blocks for process
  exit handling and connection teardown.
- **Ban on Unhandled Promises:** Never invoke async functions at top level without awaiting
  (`main();` or `.catch(console.error)` chains without awaiting). Always structure entry points as:
  ```ts
  try {
    await main();
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await cleanup();
  }
  ```

### 2.16 Framework & JSX Hygiene

- **Zod 4 Static Helper Standard:** In Zod 4+, avoid deprecated error instance methods
  (`error.flatten()`). Always use the static helper `z.flattenError(result.error)`.
- **JSX Whitespace Ambiguity (Sonar S6783):** In React JSX templates, never place naked text
  literals directly adjacent to tag boundaries where whitespace interpretation may vary. Wrap text
  in explicit `<span>` tags (e.g. `<span>LIVE STREAM</span>`).
- **Accessible Native Modals (Sonar S6848):** Modal dialog overlays must utilize the semantic
  HTML5 `<dialog open aria-modal="true">` element rather than generic `<div role="dialog">`.

---

## 3. Database Architecture & Schema Ownership

### 3.1 Migration Authority & Invariants

- **Sole Migration Tool:** Database schemas are managed exclusively by **Prisma Migrate** (`apps/api/prisma/migrations/`). Never use secondary or conflicting migration tools against shared databases.
- **Migration Commands:**
  - Local Schema Changes: `pnpm db:migrate:dev`
  - Production / Staging Deployments: `pnpm db:migrate:deploy`
  - Client Regeneration: `pnpm prisma:generate`
- **Idempotent Migration SQL:** Custom SQL migration scripts must utilize `IF NOT EXISTS` and `IF EXISTS` guards (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
- **Safe Fallback Seeds Before `NOT NULL`:** When altering columns to `NOT NULL`, supply default fallback values or insert required reference data before applying the constraint to prevent crashes on existing databases.

### 3.2 Dynamic Configuration & Feature Flags

- Flags reside in centralized configuration stores with short memory TTL caching.
- **Safe-by-Default:** All feature flags default to `false`. Missing keys resolve to `false`.
- **Synchronous Accessors:** Flag accessors must remain synchronous in request paths to allow clean query predicate construction without blocking DB connections.

---

## 4. Backend Service Specifications

### 4.1 Strict Async I/O & Non-Blocking Design

- All database queries, HTTP client requests, cache operations, and storage reads must be asynchronous.
- Never block the Node.js event loop with synchronous operations or blocking calls in request paths.

### 4.2 Error Handling & Machine-Readable Codes

- Fastify routes use `@fastify/sensible` and structured error handlers.
- Client-branchable errors must include a machine-readable code (e.g., `code: 'USER_ALREADY_EXISTS'`).
- Conflict responses (HTTP 409) report _what_ conflicted without exposing sensitive internal identities.

### 4.3 Logging Standards

- Use Fastify's structured logger (`req.log`) or centralized Pino logger (`src/config/logger.ts`).
- Never use raw `console.log()` in production backend code.
- Pass error objects directly (`logger.error({ err }, 'Message')`) to preserve complete stack traces.

---

## 5. Frontend Web Application Specifications

### 5.1 The Custom Hook Component Pattern

All pages and complex views must be organized in dedicated directories using the 3-file pattern:

```
page-name/
  page-name.tsx       # Presentation only (pure JSX, styling, icons). No state/effects.
  use-page-name.ts    # Logic hook only (state, queries, mutations, callbacks).
  index.ts            # Barrel export re-exporting the component only.
```

Barrel files must never export the custom hook.

### 5.2 Performance Non-Functional Requirements (NFRs)

1. **STRICT BAN ON TABLE POLLING:** Never use automated background polling loops
   (`refetchInterval`, recursive `setTimeout`, `setInterval`) on data listings.
2. **Mandatory Server-Side Pagination:** All data tables displaying unbounded collections must
   consume server-side paginated endpoints (`page`, `pageSize`). Client-side in-memory slicing
   of full datasets is strictly prohibited.
3. **Explicit Refresh Buttons:** Every data listing must provide an explicit, visible refresh button
   with an animated spinner during refetching.
4. **Data Caching & Transitions:** Configure `staleTime` (e.g., 30s–60s) and
   `placeholderData: keepPreviousData` in TanStack Query to eliminate layout flickering during
   pagination and filter changes.
5. **Heavy Computation Memoization:** Diff parsing, tree transformations, and static analysis
   summaries must be memoized with `useMemo` and `useCallback`.

### 5.3 React & SonarLint Compliance Guidelines

- **Prop Immutability (S6759):** Always wrap functional component props in `Readonly<Props>`: `export function Component({ title }: Readonly<ComponentProps>)`.
- **No Inline Sub-Components (S6478):** Never define sub-components or inline render functions inside parent components.
- **Native Interactive Elements (S6848 / S1082):** Never attach `onClick` handlers to non-interactive elements like `div` or `span`. Use native `<button>` or dedicated interactive components.
- **Predefined Stable IDs for Skeleton Keys (S6479):** Never use raw array indexes (`index`) as React list keys. For loading skeletons, map over arrays of objects with predefined stable IDs (`[{ id: 'skeleton-1' }]`).
- **Swap Negated Conditionals (S7735):** Convert negated conditions into positive branches by swapping execution blocks.
- **Locale-Aware Alphabetical Sorting (S2871):** Never call `.sort()` without a comparator on string arrays. Always use `arr.sort((a, b) => a.localeCompare(b))`.
- **Boolean Naming:** All booleans must use verb prefixes (`isLoading`, `hasError`, `shouldRefresh`, `isDialogOpen`).
- **No Native Dialogs:** Never use `window.confirm`, `window.alert`, or `window.prompt`. Use accessible modal dialog components.

### 5.4 Input Validation and Type Safety

- Validate external and interactive input at its boundary with Zod schemas; use `safeParse` when returning user-facing validation messages.
- Use `SyntheticEvent<HTMLFormElement>` for React form handlers that only call `preventDefault`; use `ChangeEvent` or a specific event type when event data is required.
- Do not introduce deprecated React event aliases such as `FormEvent`.
- Keep password validation aligned with Better Auth: minimum 8 and maximum 128 characters.

### 5.5 Internationalization (i18n)

- All UI strings must be retrieved via translation hooks (`const { t } = useTranslation()`) backed by `src/locales/en.json` and `es.json`.
- Never hardcode user-facing strings directly in JSX render blocks.

### 5.6 Tailwind CSS v4 Syntax

- Prefer canonical Tailwind v4 utilities, such as `bg-linear-to-r` instead of `bg-gradient-to-r`.

### 5.7 Auth & Passkey Isolation

- WebAuthn Passkeys require an active authenticated session and are managed exclusively in `SettingsPage`.
- Accessing `/login` or `/register` with an active session automatically redirects to `/`.

---

## 6. Cache, Queues & Redis Infrastructure

### 6.1 Redis Client Architecture

- Redis is accessed via `ioredis` centrally initialized in `apps/api/src/lib/redis.ts`.
- **Safe Graceful Degradation:** Redis is optional for development; client connection failures are logged without crashing the API process when not configured.
- **Connection Isolation:** Max retries and lazy connection must be configured to prevent connection storms on reconnection.

---

## 7. Testing & Quality Assurance

- **Directory Mirroring:** Backend tests live in `apps/api/tests/` mirroring the application structure.
- **Isolated Testing:** Avoid shared mutable state between test runs. Clean up database state in `afterEach` or `afterAll` hooks.
- **Bug Reproduction Invariant:** Every bug fix must land with an accompanying test that reproduces the original failure.
- **Explicit Imports:** Avoid ambient global test runners; import test utilities explicitly (`import { describe, expect, it, vi } from 'vitest'`).

---

## 8. Quality Gates & Verification Commands Matrix

Run the mandatory verification suite before declaring any task complete:

```bash
# Standard verification suite (format check, oxlint, typecheck, vitest)
pnpm check

# Pre-push verification (format, lint, typecheck, test, build)
pnpm prepush:verify

# Unused code & dependency scanner
pnpm knip

# Security CVE audit
pnpm audit

# Interactive SRE & Developer CLI
pnpm cli
```

All quality gates (formatting, linting, type-checking, tests, build) must be 100% green before presenting work for review.

---

## 9. Security & Dependency Governance

- Dependencies and security overrides are managed centrally in `pnpm-workspace.yaml`.
- All security overrides (e.g. `fast-uri`, `hono`, `mysql2`, `smol-toml`, `deepmerge-ts`) are enforced at the root workspace level.
- Run `pnpm audit` to verify CVE status across catalog and overrides.

---

## 10. Closing Checklist for AI Agents

Before declaring any engineering task complete, verify:

- [ ] No ternary operators (`? :`) introduced anywhere in `.ts`, `.tsx`, or `.py`.
- [ ] No raw emojis in UI components; Lucide React icons used exclusively.
- [ ] No commercial trade names hardcoded in code, placeholders, or translations.
- [ ] No hardcoded magic strings; domain values placed in `as const` or enums.
- [ ] All functions maintain Cognitive Complexity ≤ 15; parameter counts ≤ 7.
- [ ] Cryptographic PRNG enforced (`node:crypto` / Web Crypto); `Math.random()` strictly banned.
- [ ] Fisher-Yates shuffle used with crypto PRNG instead of `sort(() => Math.random() - 0.5)`.
- [ ] Modern ESM top-level await used in entry scripts instead of `.catch()` chains.
- [ ] Zod 4 static helpers (`z.flattenError`) used for schema error formatting.
- [ ] Modal dialogs use native HTML5 `<dialog open aria-modal="true">` elements.
- [ ] Currency values strictly maintained as integer cents (`priceCents`, `balanceCents`).
- [ ] Server-side pagination enforced for unbounded collections; client-side slicing banned.
- [ ] Table polling banned; manual refresh button implemented with visual loading state.
- [ ] React functional component props typed with `Readonly<Props>`.
- [ ] Database changes managed exclusively via Prisma Migrate (`apps/api/prisma/migrations/`).
- [ ] Living documentation in docs/ synchronized with native Mermaid diagrams for distributed flows.
- [ ] Security toolchain verified: pnpm audit clean and Gitleaks secret detection passed.
- [ ] Verification command suite executed and 100% green (`pnpm check`, `pnpm audit`, `pnpm knip`).
- [ ] Mandatory User Approval obtained before executing `git commit` or `git push`.
