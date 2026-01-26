#!/bin/bash

# Script to clean up disk space on remote server
# Usage: sudo ./cleanup-disk-space.sh

set -e

echo "=========================================="
echo "Очищення дискового простору"
echo "=========================================="
echo ""

# Check current disk usage
echo "[INFO] Поточне використання диска:"
df -h / | tail -1
echo ""

AVAILABLE=$(df -h / | tail -1 | awk '{print $4}' | sed 's/[^0-9.]//g')
AVAILABLE_GB=$(echo "$AVAILABLE" | awk '{print int($1)}')

if [ "$AVAILABLE_GB" -gt 3 ]; then
  echo "[INFO] Достатньо вільного місця (${AVAILABLE_GB}GB+), очищення не потрібне"
  exit 0
fi

echo "[WARN] Мало вільного місця (${AVAILABLE_GB}GB), починаємо очищення..."
echo ""

# Step 1: Clean Docker system
echo "[1/7] Очищення Docker системи..."
echo "  Видалення невикористовуваних образів, контейнерів, volumes..."
sudo docker system prune -af --volumes 2>/dev/null || true
echo "  ✅ Docker очищено"
echo ""

# Step 2: Remove unused Docker images
echo "[2/7] Видалення невикористовуваних Docker образів..."
sudo docker image prune -af 2>/dev/null || true
echo "  ✅ Невикористовувані образи видалено"
echo ""

# Step 3: Remove stopped containers
echo "[3/7] Видалення зупинених контейнерів..."
sudo docker container prune -f 2>/dev/null || true
echo "  ✅ Зупинені контейнери видалено"
echo ""

# Step 4: Clean Docker build cache
echo "[4/7] Очищення Docker build cache..."
sudo docker builder prune -af 2>/dev/null || true
echo "  ✅ Build cache очищено"
echo ""

# Step 5: Clean apt cache
echo "[5/7] Очищення apt cache..."
sudo apt-get clean 2>/dev/null || true
sudo apt-get autoclean 2>/dev/null || true
echo "  ✅ Apt cache очищено"
echo ""

# Step 6: Remove old logs
echo "[6/7] Очищення старих логів..."
# Docker logs
sudo find /var/lib/docker/containers -name "*.log" -type f -size +100M -delete 2>/dev/null || true
# System logs
sudo journalctl --vacuum-time=7d 2>/dev/null || true
sudo journalctl --vacuum-size=500M 2>/dev/null || true
echo "  ✅ Логи очищено"
echo ""

# Step 7: Clean temporary files
echo "[7/7] Очищення тимчасових файлів..."
sudo rm -rf /tmp/* 2>/dev/null || true
sudo rm -rf /var/tmp/* 2>/dev/null || true
echo "  ✅ Тимчасові файли очищено"
echo ""

# Final check
echo "=========================================="
echo "Очищення завершено"
echo "=========================================="
echo ""
echo "[INFO] Поточне використання диска:"
df -h / | tail -1
echo ""

AVAILABLE_AFTER=$(df -h / | tail -1 | awk '{print $4}' | sed 's/[^0-9.]//g')
AVAILABLE_GB_AFTER=$(echo "$AVAILABLE_AFTER" | awk '{print int($1)}')

if [ "$AVAILABLE_GB_AFTER" -lt 2 ]; then
  echo "[WARN] ⚠️  Все ще мало місця (${AVAILABLE_GB_AFTER}GB)"
  echo ""
  echo "Рекомендації:"
  echo "  1. Перевірте великі файли:"
  echo "     sudo du -h --max-depth=1 / | sort -hr | head -10"
  echo ""
  echo "  2. Видаліть старі Docker образи вручну:"
  echo "     sudo docker images | grep '<none>' | awk '{print \$3}' | xargs sudo docker rmi"
  echo ""
  echo "  3. Перевірте логи займають багато місця:"
  echo "     sudo du -sh /var/log/* | sort -hr | head -10"
  echo ""
else
  echo "[INFO] ✅ Достатньо вільного місця (${AVAILABLE_GB_AFTER}GB)"
  echo ""
  echo "Тепер можна виконати rebuild:"
  echo "  cd /opt/qms && sudo docker compose -f infra/docker-compose.yml build --no-cache api"
  echo ""
fi
