#!/bin/bash
# Скрипт для редеплою QMS на віддаленому сервері Ubuntu
# Використання: ./redeploy-remote-ubuntu.sh <user>@<host> [remote_path]

set -e

REMOTE_USER_HOST="$1"
REMOTE_PATH="${2:-~/qms}"

if [ -z "$REMOTE_USER_HOST" ]; then
  echo "Usage: $0 <user>@<host> [remote_path]"
  exit 1
fi

echo "[1/4] Копіюємо проект на сервер..."
rsync -az --delete --exclude 'node_modules' --exclude '.git' ./ "$REMOTE_USER_HOST:$REMOTE_PATH/"

echo "[2/4] Встановлюємо залежності та будуємо проект..."
ssh "$REMOTE_USER_HOST" "cd $REMOTE_PATH && npm install && npm run build"

echo "[3/4] Перезапускаємо сервіси (docker-compose)..."
ssh "$REMOTE_USER_HOST" "cd $REMOTE_PATH && docker-compose down && docker-compose up -d --build"

echo "[4/4] Готово! QMS перезапущено на $REMOTE_USER_HOST:$REMOTE_PATH"
