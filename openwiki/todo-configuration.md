# OpenWiki: TODO Configuration Checklist

When instantiating a new project from this template, complete the following setup steps:

- [ ] **Project Rename**:
  - Update `name` in root `package.json`, `apps/api/package.json`, and `apps/web/package.json`.
  - Update `APP_NAME` in `apps/api/src/config/constants.ts`.
- [ ] **Environment Variables Setup**:
  - Review environment variable precedence rules in [Environment Variables Guide](./environment-variables.md).
  - Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env`.
  - Update `BETTER_AUTH_SECRET` with a secure 32+ character random string in `apps/api/.env`.
  - Configure production `DATABASE_URL` and `REDIS_URL`.
- [ ] **Branding & Assets**:
  - Replace `apps/web/public/favicon.svg` and app logos.
- [ ] **Email Transporter**:
  - Enable `EMAIL_ENABLED=true` and provide SMTP credentials in `apps/api/.env`.
  - Verify SMTP connection using `pnpm cli` (Option: *SMTP Diagnostic Test*).
- [ ] **Object Storage**:
  - Set `STORAGE_PROVIDER=s3` and configure AWS S3 / MinIO bucket credentials.
- [ ] **Custom Domain Schemas**:
  - Add your domain entities to `apps/api/prisma/schema.prisma` and run `pnpm db:push`.
- [ ] **Kubernetes Production Deployment (`k8s/`)**:
  - Review [Kubernetes Deployment Guide](./kubernetes-deployment.md).
  - Copy `k8s/secrets.yaml.example` to `k8s/secrets.yaml` and fill production secrets.
  - Apply manifests using `kubectl apply -k k8s/`.
