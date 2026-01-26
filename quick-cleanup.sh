#!/bin/bash

# Quick cleanup script - aggressive cleanup
# Usage: sudo ./quick-cleanup.sh

set -e

echo "=========================================="
echo "Швидке очищення дискового простору"
echo "=========================================="
echo ""

echo "[INFO] Поточне використання диска:"
df -h / | tail -1
echo ""

echo "[INFO] Виконуємо агресивне очищення..."
echo ""

# Stop all containers (except critical ones)
echo "[1/4] Зупинка контейнерів (крім критичних)..."
sudo docker compose -f infra/docker-compose.yml stop api web 2>/dev/null || true
echo "  ✅ Контейнери зупинено"
echo ""

# Remove all unused Docker resources
echo "[2/4] Видалення всіх невикористовуваних Docker ресурсів..."
sudo docker system prune -af --volumes 2>/dev/null || true
sudo docker builder prune -af 2>/dev/null || true
echo "  ✅ Docker ресурси очищено"
echo ""

# Clean logs
echo "[3/4] Очищення логів..."
sudo journalctl --vacuum-time=3d 2>/dev/null || true
sudo journalctl --vacuum-size=200M 2>/dev/null || true
sudo find /var/lib/docker/containers -name "*.log" -type f -size +50M -delete 2>/dev/null || true
echo "  ✅ Логи очищено"
echo ""

# Clean temp files
echo "[4/4] Очищення тимчасових файлів..."
sudo rm -rf /tmp/* /var/tmp/* 2>/dev/null || true
sudo apt-get clean 2>/dev/null || true
echo "  ✅ Тимчасові файли очищено"
echo ""

# Restart containers
echo "[INFO] Перезапуск контейнерів..."
sudo docker compose -f infra/docker-compose.yml up -d 2>/dev/null || true
echo "  ✅ Контейнери перезапущено"
echo ""

echo "=========================================="
echo "Очищення завершено"
echo "=========================================="
echo ""
echo "[INFO] Поточне використання диска:"
df -h / | tail -1
echo ""

AVAILABLE=$(df -h / | tail -1 | awk '{print $4}')
echo "[INFO] Доступно: $AVAILABLE"
echo ""
