#!/bin/bash
#
# Застосувати зміни за мінімальний час.
#
# Варіант A (Docker): pull + перебілд лише api і web, рестарт лише їх.
#   Інфра (postgres, redis, opensearch, keycloak, nginx) не чіпаємо.
#
# Варіант B (локальний dev): якщо працюєте через npm run dev — достатньо
#   git pull && перезапустити api та web у терміналах (немає повного ребілду).
#
# Використання: ./apply-changes-fast.sh   або   bash apply-changes-fast.sh
#

set -e
cd "$(dirname "$0")"

echo "[1/4] Git pull..."
git pull origin main

echo "[2/4] Rebuild тільки api і web (кеш для решти)..."
docker compose -f infra/docker-compose.yml build api web

echo "[3/4] Рестарт тільки api і web..."
docker compose -f infra/docker-compose.yml up -d api web

echo "[4/4] Готово."
docker compose -f infra/docker-compose.yml ps api web
