# OpenWiki: Kubernetes Production Deployment Guide (`k8s/`)

The repository includes production-ready Kubernetes manifests under `k8s/` orchestrated with Kustomize, configured for the `task-engine` namespace.

---

## 1. Manifest Structure

- `k8s/namespace.yaml`: Dedicated namespace `task-engine`.
- `k8s/configmap.yaml`: Non-sensitive application configuration:
  - `NODE_ENV`: `'production'`
  - `PORT`: `'3100'`
  - `HOST`: `'0.0.0.0'`
  - `CORS_ORIGIN`: `'https://app.example.com'`
  - `VITE_API_URL`: `'https://api.example.com'`
- `k8s/secrets.yaml.example`: Sensitive credentials template:
  - `DATABASE_URL`: `"postgresql://postgres:secretpassword@postgres-service:5432/app_template_db?schema=task_engine"`
  - `REDIS_URL`: `"redis://redis-service:6379"`
- `k8s/api-deployment.yaml`: Deployment and ClusterIP Service for Fastify API running on port `3100`, configured with HTTP `/health` readiness and liveness probes.
- `k8s/web-deployment.yaml`: Deployment and ClusterIP Service for React Vite SPA served via Nginx on port `8080` (Service port `80`).
- `k8s/ingress.yaml`: Ingress controller rules with TLS termination via Cert-Manager routing to `web-service` (`:80`) and `api-service` (`:3100`).
- `k8s/kustomization.yaml`: Kustomize orchestration manifest binding all resources into namespace `task-engine`.

---

## 2. Deployment Instructions

### Step 1: Create Secrets Configuration

Copy the example secret manifest and populate with production credentials:

```bash
cp k8s/secrets.yaml.example k8s/secrets.yaml
```

Ensure the PostgreSQL connection string specifies the isolated schema:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: task-engine
type: Opaque
stringData:
  DATABASE_URL: "postgresql://postgres:strong-password@postgres-service:5432/production_db?schema=task_engine"
  REDIS_URL: "redis://redis-service:6379"
```

### Step 2: Deploy with Kustomize

Apply all manifests into the Kubernetes cluster:

```bash
kubectl apply -k k8s/
```

### Step 3: Verify Deployment Health

```bash
# Verify pods in task-engine namespace
kubectl get pods -n task-engine

# Inspect API logs
kubectl logs -n task-engine -l app=api -f

# Verify API health endpoint
kubectl exec -n task-engine deploy/api-deployment -- curl -s http://localhost:3100/health
```
