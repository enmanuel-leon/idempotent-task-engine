# Architecture & Design Standards

This document defines the core technical architecture, invariants, and performance non-functional requirements (NFRs) for projects initialized from this template.

---

## 🏛️ System Architecture Overview

### Backend Architecture (`apps/api`)

- **Framework**: Fastify 5 with plugin encapsulation.
- **ORM**: Prisma 7 connected to PostgreSQL.
- **Global Error Handler**: Custom Fastify error handler transforming Prisma error codes (`P2002`, `P2025`, `P2003`) and schema validation errors into standardized RFC-compliant error payloads.
- **Authentication**: Better Auth with Email/Password, Passkeys, 2FA, 6-digit Email OTP, and Organization multi-tenancy.
- **API Documentation**: OpenAPI/Swagger auto-generated schemas served at `/docs`.
- **Storage**: Abstracted Object Storage provider supporting S3/MinIO and local file system.
- **Email**: Nodemailer interface supporting SMTP (Resend/SendGrid) with localized dark-mode HTML templates.

### Frontend Architecture (`apps/web`)

- **Framework**: React 19 + Vite 8 SPA.
- **State Management**: Zustand for global stores (Theme, Locale) and TanStack Query 5 for server state.
- **Styling**: Tailwind CSS v4 with Shadcn UI components.
- **Toasts & Feedback**: Sonner toast notification system for interactive feedback.
- **Internationalization**: i18next with JSON dictionaries in `src/locales/`.
- **Custom Hook Pattern**: Every view is separated into:
  - `page.tsx`: Declarative presentation component.
  - `use-page.ts`: Logic hook for state, queries, and handlers.
  - `index.ts`: Export barrel.

---

## 🌐 Environment Variables Architecture & Precedence

Environment configuration is scoped by application. The root `.env` is intended for Docker Compose infrastructure, `apps/api/.env` is for backend runtime settings, and `apps/web/.env` is for frontend build-time settings. Application-specific values override root values when a loader reads both files, while process, container, CI, and Kubernetes variables always have priority.

Backend-only variables must remain in the API environment and must never be exposed to the browser. Vite only makes variables with the `VITE_` prefix available to frontend code, and those values are compiled into the production assets.

Environment variables follow a strict hierarchy of precedence across development and production environments:

1. **System Process Environment** (OS variables, Docker Secrets, Kubernetes Secrets/ConfigMaps) **[Highest Priority]**
2. **Application `.env` File** (`apps/api/.env` or `apps/web/.env`)
3. **Monorepo Root `.env` File** (`/.env`)
4. **Code Default Fallbacks** (`env.ts` / Zod defaults) **[Lowest Priority]**

### Runtime vs Build-Time Evaluation

- **Backend (`apps/api`)**: Evaluated at **runtime** on every incoming HTTP request.
- **Frontend (`apps/web`)**: Evaluated at **build-time** by Vite (`vite build`). `VITE_*` variables are compiled into static assets.

---

## ⛔ The "NO Ternary Operators" Rule (Non-Negotiable)

Ternary conditional expressions (`condition ? a : b`) are **strictly prohibited** across the entire codebase.

- **In TypeScript logic (`.ts`)**: Use standard `if/else` control flow blocks with early returns.
- **In React rendering (`.tsx`)**: Pre-calculate render branches inside local variables in custom hooks or directly before the `return` statement, or leverage safe `&&` guards.
- **In CSS styling**: Always use the `cn()` class merger utility (e.g., `cn("base-style", isActive && "active-style")`).

---

## ⚡ Frontend Performance NFRs

1. **NO Table Polling**: Automated background polling for data tables (refetchInterval loops or recursive timeouts) is banned.
2. **Explicit Refresh Buttons**: Provide manual refresh buttons on table views to allow users to trigger a manual refetch on demand.
3. **Data Caching & Transitions**: Leverage TanStack Query caching (`staleTime: 60000`, `placeholderData`) to maintain UI stability.
4. **Memoize Heavy Computations**: Memoize costly computations using `useMemo` and `useCallback`.
5. **Stacked ID Display**: Display tenant/organization UUIDs directly underneath the name using a vertical `flex flex-col` layout with font-mono text (`font-mono text-[10px] opacity-60`).
