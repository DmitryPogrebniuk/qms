#!/bin/bash
#
# Запуск QMS після ребуту сервера
#
# Використання:
#   ./start-qms.sh          # запустити через docker compose
#   ./start-qms.sh --systemd # запустити через systemd (якщо є qms.service)
#

set -e

INSTALL_DIR="${QMS_DIR:-/opt/qms}"
COMPOSE_FILE="infra/docker-compose.yml"

cd "$INSTALL_DIR" || { echo "Помилка: директорія $INSTALL_DIR не існує"; exit 1; }

if [ "$1" = "--systemd" ]; then
  echo "Запуск QMS через systemd..."
  sudo systemctl start qms
  echo "✓ Команда виконана. Перевірте: sudo systemctl status qms"
else
  echo "Запуск QMS (Docker Compose)..."
  sudo docker compose -f "$COMPOSE_FILE" up -d
  echo ""
  echo "✓ Контейнери запущено."
  echo ""
  sudo docker compose -f "$COMPOSE_FILE" ps
  echo ""
  echo "Перевірка: curl -s http://localhost:3000/api/health 2>/dev/null || echo 'API ще запускається...'"
fi
