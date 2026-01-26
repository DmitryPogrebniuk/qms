#!/bin/bash

# Script to deploy MediaSense automation (Playwright) on remote server
# Usage: sudo ./deploy-mediasense-automation.sh

set -e

cd /opt/qms || exit 1

echo "=========================================="
echo "Deploy MediaSense Automation (Playwright)"
echo "=========================================="
echo ""

# Step 1: Pull latest changes
echo "[1/6] Отримання останніх змін з git..."
git pull origin main
echo "  ✅ Git pull завершено"
echo ""

# Step 2: Check MediaSense configuration
echo "[2/6] Перевірка конфігурації MediaSense в БД..."
if sudo ./check-mediasense-config.sh > /dev/null 2>&1; then
  echo "  ✅ MediaSense налаштовано"
else
  echo "  ⚠️  MediaSense не налаштовано в БД"
  echo ""
  echo "  Налаштуйте MediaSense через веб-інтерфейс:"
  echo "    http://$(hostname -I | awk '{print $1}'):5173"
  echo "    Settings → Integrations → MediaSense"
  echo ""
  read -p "  Продовжити з rebuild? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi
echo ""

# Step 3: Rebuild API container (to install Playwright and Chromium)
echo "[3/6] Rebuild API контейнера (встановлення Playwright та Chromium)..."
echo "  Це може зайняти 5-10 хвилин..."
sudo docker compose -f infra/docker-compose.yml build --no-cache api
echo "  ✅ Build завершено"
echo ""

# Step 4: Restart API container
echo "[4/6] Перезапуск API контейнера..."
sudo docker compose -f infra/docker-compose.yml up -d api
echo "  ✅ API перезапущено"
echo ""

# Step 5: Wait for API to start
echo "[5/6] Очікування запуску API..."
sleep 10

# Check if API is running
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "  ✅ API запущено та відповідає"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  echo "  Очікування... ($ATTEMPT/$MAX_ATTEMPTS)"
  sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  echo "  ⚠️  API не відповідає, але продовжуємо..."
fi
echo ""

# Step 6: Verify Playwright installation
echo "[6/6] Перевірка встановлення Playwright..."
CHROMIUM_PATH=$(sudo docker compose -f infra/docker-compose.yml exec -T api which chromium 2>/dev/null || echo "")
if [ -n "$CHROMIUM_PATH" ]; then
  echo "  ✅ Chromium знайдено: $CHROMIUM_PATH"
  CHROMIUM_VERSION=$(sudo docker compose -f infra/docker-compose.yml exec -T api chromium --version 2>/dev/null || echo "unknown")
  echo "  ✅ Версія: $CHROMIUM_VERSION"
else
  echo "  ⚠️  Chromium не знайдено в контейнері"
  echo "  Перевірте Dockerfile.api - можливо потрібні додаткові кроки"
fi
echo ""

# Step 7: Run diagnostics
echo "=========================================="
echo "Запуск діагностики MediaSense"
echo "=========================================="
echo ""

sudo ./diagnose-mediasense-detailed.sh

echo ""
echo "=========================================="
echo "Deploy завершено"
echo "=========================================="
echo ""
echo "Наступні кроки:"
echo "  1. Перевірте логи API:"
echo "     sudo docker compose -f infra/docker-compose.yml logs api | tail -50"
echo ""
echo "  2. Перевірте логи Playwright automation:"
echo "     sudo docker compose -f infra/docker-compose.yml logs api | grep -i 'cookie\|playwright\|browser' | tail -30"
echo ""
echo "  3. Запустіть синхронізацію вручну (якщо потрібно):"
echo "     curl -X POST http://localhost:3000/api/recordings/admin/sync-now \\"
echo "       -H 'Authorization: Bearer YOUR_JWT_TOKEN'"
echo ""
echo "  4. Перевірте статус синхронізації:"
echo "     sudo ./check-sync-status.sh"
echo ""
