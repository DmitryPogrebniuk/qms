#!/bin/bash

# Quick script to check MediaSense configuration in DB
# Usage: sudo ./check-mediasense-config.sh

set -e

echo "=========================================="
echo "Перевірка конфігурації MediaSense в БД"
echo "=========================================="
echo ""

# Try both possible database users
for DB_USER in "qms" "qms_user"; do
  echo "[INFO] Спробуємо користувача БД: $DB_USER"
  
  # Check if user exists and can connect
  CAN_CONNECT=$(sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U "$DB_USER" -d qms -c "SELECT 1;" 2>&1 | grep -c "1 row" || echo "0")
  
  if [ "$CAN_CONNECT" != "0" ]; then
    echo "[INFO] ✅ Підключення до БД успішне з користувачем: $DB_USER"
    echo ""
    
    # Check if IntegrationSetting table exists
    TABLE_EXISTS=$(sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U "$DB_USER" -d qms -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'IntegrationSetting');" 2>/dev/null | tr -d ' \n' || echo "f")
    
    if [ "$TABLE_EXISTS" != "t" ]; then
      echo "[ERROR] Таблиця IntegrationSetting не існує"
      exit 1
    fi
    
    # Check if MediaSense setting exists
    SETTING_EXISTS=$(sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U "$DB_USER" -d qms -t -c "SELECT COUNT(*) FROM \"IntegrationSetting\" WHERE \"integrationType\" = 'mediasense';" 2>/dev/null | tr -d ' \n' || echo "0")
    
    if [ "$SETTING_EXISTS" = "0" ]; then
      echo "[WARN] MediaSense не налаштовано в БД"
      echo ""
      echo "Для налаштування MediaSense:"
      echo "  1. Відкрийте веб-інтерфейс: http://localhost:5173"
      echo "  2. Перейдіть до Settings → Integrations → MediaSense"
      echo "  3. Введіть налаштування:"
      echo "     - API URL: https://192.168.200.133:8440"
      echo "     - API Key: ваш username"
      echo "     - API Secret: ваш password"
      echo "     - Allow Self-Signed: true"
      echo "  4. Натисніть Save"
      echo ""
      exit 1
    fi
    
    # Get full setting
    echo "[INFO] Знайдено налаштування MediaSense:"
    echo ""
    sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U "$DB_USER" -d qms -c "
      SELECT 
        \"integrationType\",
        \"isEnabled\",
        \"isConfigured\",
        settings,
        \"lastTestAt\",
        \"lastTestSuccess\",
        \"lastTestError\"
      FROM \"IntegrationSetting\"
      WHERE \"integrationType\" = 'mediasense';
    " 2>/dev/null
    
    echo ""
    echo "[INFO] Детальна інформація про settings (JSON):"
    sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U "$DB_USER" -d qms -t -A -c "SELECT settings::text FROM \"IntegrationSetting\" WHERE \"integrationType\" = 'mediasense' LIMIT 1;" 2>/dev/null | head -1
    
    echo ""
    echo "=========================================="
    echo "Перевірка завершена"
    echo "=========================================="
    exit 0
  else
    echo "[WARN] Не вдалося підключитися з користувачем: $DB_USER"
    echo ""
  fi
done

echo "[ERROR] Не вдалося підключитися до БД з жодним користувачем"
echo ""
echo "Перевірте:"
echo "  1. Чи запущений контейнер postgres?"
echo "  2. Чи правильні credentials в docker-compose.yml?"
echo ""
