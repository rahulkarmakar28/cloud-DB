#!/usr/bin/env bash
set -e

CLUSTER_NAME="dbcloud"

echo "=================================="
echo "Starting DBCloud Development Setup"
echo "=================================="

# Create Kind cluster if missing

if ! kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
echo "[1/6] Creating Kind cluster..."
kind create cluster 
--name "${CLUSTER_NAME}" 
--image kindest/node:v1.30.10
else
echo "[1/6] Kind cluster already exists"
fi

kubectl config use-context "kind-${CLUSTER_NAME}"

echo "[2/6] Verifying cluster..."
kubectl get nodes

echo "[3/6] Starting PostgreSQL..."
docker compose up -d postgres

echo "[4/6] Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U dbcloud >/dev/null 2>&1
do
sleep 2
done

echo "[5/6] Running migrations..."
cd backend
npm install
npm run migrate

echo "[6/6] Starting backend..."
npm run dev
