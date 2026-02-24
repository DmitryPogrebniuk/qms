#!/bin/bash
# Діагностика сервісів QMS після проблем з SSL/nginx
set -e
cd "$(dirname "$0")"

echo "=== Статус контейнерів ==="
docker compose ps -a

echo ""
echo "=== Останні логи API (якщо 504 — API не відповідає) ==="
docker compose logs --tail 30 api 2>/dev/null || true

echo ""
echo "=== Останні логи nginx ==="
docker compose logs --tail 15 nginx 2>/dev/null || true

echo ""
echo "=== Перевірка API (nginx -> api) ==="
docker compose exec nginx wget -qO- --timeout=5 http://api:3000/api/health 2>/dev/null || echo "API недоступний (504 = api не відповідає)"
