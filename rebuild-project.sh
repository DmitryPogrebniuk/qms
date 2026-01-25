#!/bin/bash
#
# Pull та rebuild проекту
# Використання: sudo ./rebuild-project.sh
#

set -e

echo "=========================================="
echo "Pull та rebuild проекту"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

cd /opt/qms || exit 1

# Крок 1: Git pull
log_info "Крок 1: Оновлення коду з репозиторію..."
if sudo git pull origin main; then
    log_info "✓ Код оновлено"
else
    log_error "✗ Помилка при оновленні коду"
    exit 1
fi

echo ""

# Крок 2: Зупинка контейнерів
log_info "Крок 2: Зупинка контейнерів..."
if sudo docker compose -f infra/docker-compose.yml down; then
    log_info "✓ Контейнери зупинено"
else
    log_warn "⚠ Деякі контейнери могли не зупинитися"
fi

echo ""

# Крок 3: Rebuild образів
log_info "Крок 3: Rebuild Docker образів..."
if sudo docker compose -f infra/docker-compose.yml build --no-cache; then
    log_info "✓ Образі перебудовано"
else
    log_error "✗ Помилка при rebuild образів"
    exit 1
fi

echo ""

# Крок 4: Запуск контейнерів
log_info "Крок 4: Запуск контейнерів..."
if sudo docker compose -f infra/docker-compose.yml up -d; then
    log_info "✓ Контейнери запущено"
else
    log_error "✗ Помилка при запуску контейнерів"
    exit 1
fi

echo ""

# Крок 5: Очікування ініціалізації
log_info "Крок 5: Очікування ініціалізації (30 секунд)..."
sleep 30

echo ""

# Крок 6: Перевірка статусу
log_info "Крок 6: Перевірка статусу контейнерів..."
sudo docker compose -f infra/docker-compose.yml ps

echo ""
log_info "=========================================="
log_info "Rebuild завершено"
log_info "=========================================="
log_info ""
log_info "Наступні кроки:"
log_info "1. Перевірте логи:"
echo "   sudo docker compose -f infra/docker-compose.yml logs api | tail -50"
log_info ""
log_info "2. Перевірте статус синхронізації:"
echo "   sudo ./check-sync-status.sh"
log_info ""
log_info "3. Перевірте автентифікацію MediaSense:"
echo "   sudo ./diagnose-mediasense-auth.sh"
echo ""
