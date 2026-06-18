# DBCloud — Kubernetes-Native Database as a Service

A production-ready NeonDB-inspired platform that deploys **real databases** on your Kubernetes cluster. Built with **Hono** (backend) + **React + TypeScript** (frontend).

---

## Features

- **Real Kubernetes provisioning** — creates actual StatefulSets, Deployments, Services, HPAs, PVCs
- **4 engines** — PostgreSQL, MySQL, Redis, MongoDB
- **JWT authentication** — register/login with bcrypt-hashed passwords, access + refresh token rotation
- **Autoscaling** — HPA configured with CPU/memory thresholds
- **Read replicas** — separate Deployment with its own ClusterIP service
- **Persistent storage** — PVCs with configurable storage class
- **Live metrics** — real pod CPU/memory from metrics-server
- **Connection strings** — formatted per-engine, copy-ready
- **K8s manifests viewer** — see the exact YAML applied to your cluster
- **Pause/Resume** — scale StatefulSet to 0 and back
- **Full delete** — removes the entire namespace and all resources

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    docker-compose                         │
│                                                          │
│  ┌──────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │ postgres │   │   backend    │   │    frontend     │  │
│  │ (store)  │◄──│   (Hono)     │◄──│  (React + TS)   │  │
│  └──────────┘   └──────┬───────┘   └─────────────────┘  │
│                        │                                  │
└────────────────────────│─────────────────────────────────┘
                         │ @kubernetes/client-node
                         ▼
              ┌─────────────────────┐
              │   Kubernetes API    │
              │                     │
              │  dbcloud-<id>/      │
              │  ├─ StatefulSet     │
              │  ├─ Deployment      │
              │  ├─ HPA             │
              │  ├─ Services        │
              │  ├─ PVC             │
              │  └─ Secrets         │
              └─────────────────────┘
```

---

## Prerequisites

- Docker + Docker Compose
- A running Kubernetes cluster accessible via `~/.kube/config`
  - Local: [minikube](https://minikube.sigs.k8s.io/), [k3s](https://k3s.io/), [kind](https://kind.sigs.k8s.io/)
  - Cloud: EKS, GKE, AKS (just ensure kubeconfig is set)
- (Optional) `metrics-server` for real CPU/memory metrics

---

## Quick Start

```bash
# 1. Clone / extract
cd dbcloud

# 2. Start everything
docker-compose up --build

# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

Register an account, create a database — the backend will:
1. Insert the record as `provisioning` in PostgreSQL
2. Call the Kubernetes API to create the namespace + StatefulSet + Services
3. Update the record with the real internal hostname + connection string
4. Poll status every 5 seconds in the UI until pods are `Running`

---

## Connecting to Your Database

Databases run with `ClusterIP` services (internal only). To connect from your machine:

```bash
# Port-forward the primary service
kubectl port-forward svc/db-<id>-svc <port>:<port> -n dbcloud-<id>

# Examples:
kubectl port-forward svc/db-abc123-svc 5432:5432 -n dbcloud-abc123
psql "postgresql://usr_abc123:password@localhost:5432/mydb"

kubectl port-forward svc/db-abc123-svc 6379:6379 -n dbcloud-abc123
redis-cli -h localhost -p 6379 -a password
```

The exact `kubectl port-forward` command is shown in the **Connect** tab of each database.

---

## Environment Variables

### Backend

| Variable          | Default                          | Description                         |
|-------------------|----------------------------------|-------------------------------------|
| `PORT`            | `3001`                           | API server port                     |
| `DB_HOST`         | `postgres`                       | PostgreSQL host (internal store)    |
| `DB_PORT`         | `5432`                           | PostgreSQL port                     |
| `DB_NAME`         | `dbcloud`                        | PostgreSQL database                 |
| `DB_USER`         | `dbcloud`                        | PostgreSQL user                     |
| `DB_PASSWORD`     | `dbcloud_secret`                 | PostgreSQL password                 |
| `JWT_SECRET`      | `change_me_in_production...`     | Access token signing secret         |
| `JWT_EXPIRES`     | `15m`                            | Access token lifetime               |
| `REFRESH_SECRET`  | `change_me_refresh...`           | Refresh token signing secret        |
| `REFRESH_EXPIRES` | `7d`                             | Refresh token lifetime              |
| `KUBECONFIG`      | `/root/.kube/config`             | Path to kubeconfig inside container |
| `STORAGE_CLASS`   | *(default)*                      | K8s StorageClass for PVCs           |
| `FRONTEND_URL`    | `*`                              | CORS allowed origin                 |

---

## API Reference

### Auth

| Method | Path                  | Auth | Description              |
|--------|-----------------------|------|--------------------------|
| POST   | `/api/auth/register`  | —    | Register new user        |
| POST   | `/api/auth/login`     | —    | Login, get tokens        |
| POST   | `/api/auth/refresh`   | —    | Rotate refresh token     |
| POST   | `/api/auth/logout`    | JWT  | Revoke refresh token     |
| GET    | `/api/auth/me`        | JWT  | Get current user         |

### Databases

| Method | Path                             | Auth | Description              |
|--------|----------------------------------|------|--------------------------|
| GET    | `/api/databases`                 | JWT  | List user's databases    |
| POST   | `/api/databases`                 | JWT  | Create + provision       |
| GET    | `/api/databases/:id`             | JWT  | Get details + live status|
| DELETE | `/api/databases/:id`             | JWT  | Delete + deprovision     |
| PATCH  | `/api/databases/:id/pause`       | JWT  | Scale to 0 replicas      |
| PATCH  | `/api/databases/:id/resume`      | JWT  | Scale back to 1          |
| GET    | `/api/databases/:id/metrics`     | JWT  | Pod metrics              |
| GET    | `/api/databases/:id/manifests`   | JWT  | K8s YAML manifests       |

---

## Production Checklist

- [ ] Change `JWT_SECRET` and `REFRESH_SECRET` to long random strings
- [ ] Use a real PostgreSQL instance (RDS, Cloud SQL, etc.)
- [ ] Set `STORAGE_CLASS` to your cloud provider's fast SSD class (`gp3`, `premium-rw`, etc.)
- [ ] Configure S3-compatible backup storage
- [ ] Add TLS via cert-manager for database endpoints
- [ ] Set `FRONTEND_URL` to your actual domain
- [ ] Add network policies for namespace isolation
- [ ] Install metrics-server for real monitoring

---

## Local Cluster Setup (minikube)

```bash
# Start minikube
minikube start --memory=4096 --cpus=4

# Enable metrics-server
minikube addons enable metrics-server

# Enable storage provisioner (already enabled by default)
minikube addons enable default-storageclass

# Run DBCloud
docker-compose up --build
```

The backend mounts `~/.kube/config` read-only into the container, so it picks up your minikube context automatically.
