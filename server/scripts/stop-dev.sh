#!/usr/bin/env bash

docker compose down

kind delete cluster --name dbcloud

echo "Everything stopped."