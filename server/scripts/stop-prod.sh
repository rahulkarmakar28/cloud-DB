#!/usr/bin/env bash
set -e

echo "=================================="
echo "Stopping DBCloud Production"
echo "=================================="

echo "[1/4] Removing frontend..."
kubectl delete -f k8s/frontend/ --ignore-not-found

echo "[2/4] Removing backend..."
kubectl delete -f k8s/backend/ --ignore-not-found

echo "[3/4] Removing PostgreSQL..."
kubectl delete -f k8s/postgres/ --ignore-not-found

echo "[4/4] Removing namespace..."
kubectl delete namespace dbcloud --ignore-not-found

echo "DBCloud production resources removed."