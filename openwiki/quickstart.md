# OpenWiki: Architecture & Quickstart Guide

Welcome to the **Monorepo App Template** OpenWiki documentation hub.

---

## 📌 Configured Features Out-of-the-Box

1. **Fastify 5 Backend** (`apps/api`): Clean MVC structure, Zod env validation, Fastify Prisma global error handler, and Swagger OpenAPI `/docs`.
2. **Better Auth System**: Support for credentials, passkeys, 2FA, 6-digit OTP email verification, and full Organization multi-tenancy.
3. **React 19 + Vite 8 SPA** (`apps/web`): Modern SPA with i18n multilanguage support, Sonner toast notifications, Zustand stores, and TanStack Query.
4. **Prisma 7 Database**: PostgreSQL schema with User, Session, Account, Organization, Member, and sample Item CRUD models.
5. **Docker Infrastructure**: Compose configurations for local dev (Postgres + Redis + MinIO) and production stack.
6. **Kubernetes Production Manifests** (`k8s/`): Ready-to-use Deployments, Services, ConfigMaps, Secrets, and Ingress with Kustomize.

---

## 🔗 OpenWiki Documentation Hub Pages

- [Environment Variables Architecture & Priority](./environment-variables.md)
- [Interactive Developer & SRE Console Guide (`pnpm cli`)](./cli-operations.md)
- [Kubernetes Production Deployment Guide (`k8s/`)](./kubernetes-deployment.md)
- [TODO Configuration Checklist](./todo-configuration.md)
