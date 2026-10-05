# OpenWiki: Kubernetes Production Deployment Guide (`k8s/`)

The repository includes production Kubernetes manifests under `k8s/` configured for Kustomize.

---

## 📦 Manifest Structure

- `k8s/namespace.yaml`: Namespace `app-template`.
- `k8s/configmap.yaml`: Non-sensitive application configuration (`NODE_ENV`, `PORT`, `CORS_ORIGIN`, `VITE_API_URL`).
- `k8s/secrets.yaml.example`: Template for sensitive credentials (`DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `SMTP_PASS`).
- `k8s/api-deployment.yaml`: Deployment & ClusterIP Service for Fastify API with readiness and liveness probes.
- `k8s/web-deployment.yaml`: Deployment & ClusterIP Service for React Nginx SPA.
- `k8s/ingress.yaml`: Ingress controller rules with TLS termination via Cert-Manager.
- `k8s/kustomization.yaml`: Kustomize orchestration manifest.

---

## 🚀 Deployment Instructions

1. Copy secret template:
   ```bash
   cp k8s/secrets.yaml.example k8s/secrets.yaml
   ```
2. Fill production credentials in `k8s/secrets.yaml`.
3. Apply all manifests using Kustomize:
   ```bash
   kubectl apply -k k8s/
   ```
