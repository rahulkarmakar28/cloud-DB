#!/usr/bin/env bash
set -e

echo "=================================="
echo "Deploying DBCloud Production"
echo "=================================="

echo "[1/5] Building images..."
docker build -t dbcloud-backend:latest ./backend
docker build -t dbcloud-frontend:latest ./frontend

echo "[2/5] Applying namespace..."
kubectl apply -f k8s/namespace.yaml

echo "[3/5] Applying PostgreSQL..."
kubectl apply -f k8s/postgres/

echo "[4/5] Applying backend..."
kubectl apply -f k8s/backend/

echo "[5/5] Applying frontend..."
kubectl apply -f k8s/frontend/

echo "Deployment complete."

kubectl get pods -A
