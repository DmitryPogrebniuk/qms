#!/bin/bash

# Detailed MediaSense diagnostics script
# Usage: sudo ./diagnose-mediasense-detailed.sh

set -e

echo "=========================================="
echo "Детальна діагностика MediaSense"
echo "=========================================="
echo ""

# Get MediaSense config from DB
echo "[INFO] Отримання конфігурації MediaSense з БД..."

# Try both possible database users
DB_USER="qms"
SETTING_EXISTS=$(sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U "$DB_USER" -d qms -t -c "SELECT COUNT(*) FROM \"IntegrationSetting\" WHERE \"integrationType\" = 'mediasense'" 2>/dev/null | tr -d ' \n' || echo "0")

# If failed, try qms_user
if [ "$SETTING_EXISTS" = "0" ] || [ -z "$SETTING_EXISTS" ]; then
  DB_USER="qms_user"
  SETTING_EXISTS=$(sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U "$DB_USER" -d qms -t -c "SELECT COUNT(*) FROM \"IntegrationSetting\" WHERE \"integrationType\" = 'mediasense'" 2>/dev/null | tr -d ' \n' || echo "0")
fi

if [ "$SETTING_EXISTS" = "0" ] || [ -z "$SETTING_EXISTS" ]; then
  echo "[ERROR] MediaSense не налаштовано в БД"
  echo ""
  echo "Для налаштування MediaSense:"
  echo "  1. Відкрийте веб-інтерфейс: http://localhost:5173 (або ваш URL)"
  echo "  2. Перейдіть до Settings → Integrations → MediaSense"
  echo "  3. Введіть налаштування та збережіть"
  echo ""
  echo "Або через API:"
  echo "  curl -X PUT http://localhost:3000/api/integrations/mediasense \\"
  echo "    -H 'Authorization: Bearer YOUR_TOKEN' \\"
  echo "    -H 'Content-Type: application/json' \\"
  echo "    -d '{\"apiUrl\":\"https://192.168.200.133:8440\",\"apiKey\":\"user\",\"apiSecret\":\"pass\",\"allowSelfSigned\":true}'"
  echo ""
  exit 1
fi

# Get settings JSON
CONFIG=$(sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U "$DB_USER" -d qms -t -A -c "SELECT settings::text FROM \"IntegrationSetting\" WHERE \"integrationType\" = 'mediasense' LIMIT 1" 2>/dev/null | head -1)

if [ -z "$CONFIG" ] || [ "$CONFIG" = "" ] || [ "$CONFIG" = "{}" ]; then
  echo "[ERROR] MediaSense налаштовано, але settings порожні"
  echo ""
  echo "Перевірте налаштування в БД:"
  echo "  sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U qms -d qms -c \"SELECT * FROM \\\"IntegrationSetting\\\" WHERE \\\"integrationType\\\" = 'mediasense';\""
  echo ""
  exit 1
fi

# Check if enabled
IS_ENABLED=$(sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U "$DB_USER" -d qms -t -A -c "SELECT \"isEnabled\" FROM \"IntegrationSetting\" WHERE \"integrationType\" = 'mediasense' LIMIT 1" 2>/dev/null | tr -d ' \n' || echo "false")

if [ "$IS_ENABLED" != "t" ] && [ "$IS_ENABLED" != "true" ]; then
  echo "[WARN] MediaSense налаштовано, але не увімкнено (isEnabled = false)"
  echo ""
fi

# Extract config values (basic parsing)
# Handle both JSON format and escaped JSON
API_URL=$(echo "$CONFIG" | grep -oE '"apiUrl"\s*:\s*"[^"]*"' | grep -oE '"[^"]*"' | head -1 | tr -d '"' || echo "")
API_USER=$(echo "$CONFIG" | grep -oE '"apiKey"\s*:\s*"[^"]*"' | grep -oE '"[^"]*"' | head -1 | tr -d '"' || echo "")
API_PASS=$(echo "$CONFIG" | grep -oE '"apiSecret"\s*:\s*"[^"]*"' | grep -oE '"[^"]*"' | head -1 | tr -d '"' || echo "")

# Alternative parsing if first method didn't work
if [ -z "$API_URL" ]; then
  API_URL=$(echo "$CONFIG" | sed -n 's/.*"apiUrl":"\([^"]*\)".*/\1/p' | head -1)
fi
if [ -z "$API_USER" ]; then
  API_USER=$(echo "$CONFIG" | sed -n 's/.*"apiKey":"\([^"]*\)".*/\1/p' | head -1)
fi
if [ -z "$API_PASS" ]; then
  API_PASS=$(echo "$CONFIG" | sed -n 's/.*"apiSecret":"\([^"]*\)".*/\1/p' | head -1)
fi

if [ -z "$API_URL" ] || [ -z "$API_USER" ] || [ -z "$API_PASS" ]; then
  echo "[ERROR] Не вдалося отримати конфігурацію з БД"
  echo ""
  echo "Raw config from DB:"
  echo "$CONFIG" | head -5
  echo ""
  echo "Перевірте налаштування вручну:"
  echo "  sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U $DB_USER -d qms -c \"SELECT * FROM \\\"IntegrationSetting\\\" WHERE \\\"integrationType\\\" = 'mediasense';\""
  echo ""
  echo "Або налаштуйте MediaSense через веб-інтерфейс:"
  echo "  http://localhost:5173 (Settings → Integrations → MediaSense)"
  echo ""
  exit 1
fi

echo "[INFO]   URL: $API_URL"
echo "[INFO]   User: $API_USER"
echo ""

# Test 1: Check if web interface is accessible
echo "[TEST 1] Перевірка доступності веб-інтерфейсу MediaSense..."
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" "$API_URL/" --max-time 10 || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "401" ]; then
  echo "  ✅ Веб-інтерфейс доступний (HTTP $HTTP_CODE)"
else
  echo "  ❌ Веб-інтерфейс недоступний (HTTP $HTTP_CODE)"
fi
echo ""

# Test 2: Check login form
echo "[TEST 2] Перевірка форми логіну..."
LOGIN_PAGE=$(curl -k -s "$API_URL/" --max-time 10 || echo "")
if echo "$LOGIN_PAGE" | grep -q "j_username\|username\|login" > /dev/null; then
  echo "  ✅ Форма логіну знайдена"
  echo "  Форма містить поля:"
  echo "$LOGIN_PAGE" | grep -o 'name="[^"]*"' | sort -u | head -5
else
  echo "  ⚠️  Форма логіну не знайдена або нестандартна"
fi
echo ""

# Test 3: Test j_security_check endpoint
echo "[TEST 3] Тест /j_security_check endpoint..."
RESPONSE=$(curl -k -s -i -X POST "$API_URL/j_security_check" \
  -d "j_username=$API_USER&j_password=$API_PASS" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --max-time 15 2>&1 || echo "ERROR")

HTTP_STATUS=$(echo "$RESPONSE" | head -1 | grep -o '[0-9]\{3\}' || echo "000")
SET_COOKIE=$(echo "$RESPONSE" | grep -i "set-cookie" | head -1 || echo "")

echo "  HTTP Status: $HTTP_STATUS"
if [ -n "$SET_COOKIE" ]; then
  echo "  ✅ Set-Cookie заголовок знайдено:"
  echo "    $SET_COOKIE"
  if echo "$SET_COOKIE" | grep -qi "JSESSIONID"; then
    JSESSIONID=$(echo "$SET_COOKIE" | grep -o 'JSESSIONID[^;]*' | head -1)
    echo "  ✅ JSESSIONID знайдено: ${JSESSIONID:0:50}..."
  else
    echo "  ⚠️  JSESSIONID не знайдено в Set-Cookie"
  fi
else
  echo "  ❌ Set-Cookie заголовок відсутній"
fi
echo ""

# Test 4: Test REST API login
echo "[TEST 4] Тест REST API /ora/authenticationService/authentication/login..."
AUTH=$(echo -n "$API_USER:$API_PASS" | base64)
RESPONSE=$(curl -k -s -i -X POST "$API_URL/ora/authenticationService/authentication/login" \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"username\":\"$API_USER\",\"password\":\"$API_PASS\"}" \
  --max-time 15 2>&1 || echo "ERROR")

HTTP_STATUS=$(echo "$RESPONSE" | head -1 | grep -o '[0-9]\{3\}' || echo "000")
SET_COOKIE=$(echo "$RESPONSE" | grep -i "set-cookie" | head -1 || echo "")
BODY=$(echo "$RESPONSE" | tail -1)

echo "  HTTP Status: $HTTP_STATUS"
if [ -n "$SET_COOKIE" ]; then
  echo "  ✅ Set-Cookie заголовок знайдено"
else
  echo "  ❌ Set-Cookie заголовок відсутній"
fi

# Check response body for error codes
if echo "$BODY" | grep -q "responseCode"; then
  RESPONSE_CODE=$(echo "$BODY" | grep -o '"responseCode":[0-9]*' | cut -d':' -f2 || echo "")
  RESPONSE_MSG=$(echo "$BODY" | grep -o '"responseMessage":"[^"]*"' | cut -d'"' -f4 || echo "")
  echo "  Response Code: $RESPONSE_CODE"
  echo "  Response Message: $RESPONSE_MSG"
  if [ "$RESPONSE_CODE" = "4021" ]; then
    echo "  ⚠️  Invalid session error (4021)"
  fi
fi
echo ""

# Test 5: Check Playwright/Cookie service logs
echo "[TEST 5] Перевірка логів Playwright automation..."
COOKIE_LOGS=$(sudo docker compose -f infra/docker-compose.yml logs --tail=50 api | grep -i "cookie\|playwright\|browser\|web interface" | tail -10 || echo "")
if [ -n "$COOKIE_LOGS" ]; then
  echo "  Останні логи cookie service:"
  echo "$COOKIE_LOGS" | sed 's/^/    /'
else
  echo "  ⚠️  Логи cookie service не знайдено (можливо не використовується)"
fi
echo ""

# Test 6: Check sync errors
echo "[TEST 6] Перевірка помилок синхронізації..."
SYNC_ERRORS=$(sudo docker compose -f infra/docker-compose.yml logs --tail=100 api | grep -i "mediasense.*error\|sync.*error\|4021\|invalid session" | tail -10 || echo "")
if [ -n "$SYNC_ERRORS" ]; then
  echo "  Останні помилки:"
  echo "$SYNC_ERRORS" | sed 's/^/    /'
else
  echo "  ✅ Помилок не знайдено"
fi
echo ""

# Test 7: Check if Playwright is available in container
echo "[TEST 7] Перевірка наявності Playwright в контейнері..."
PLAYWRIGHT_CHECK=$(sudo docker compose -f infra/docker-compose.yml exec -T api sh -c "which chromium || which chromium-browser || echo 'NOT_FOUND'" 2>/dev/null || echo "ERROR")
if [ "$PLAYWRIGHT_CHECK" != "NOT_FOUND" ] && [ "$PLAYWRIGHT_CHECK" != "ERROR" ]; then
  echo "  ✅ Chromium знайдено: $PLAYWRIGHT_CHECK"
else
  echo "  ⚠️  Chromium не знайдено в контейнері"
  echo "  Перевірте Dockerfile - можливо потрібен rebuild"
fi
echo ""

# Summary
echo "=========================================="
echo "Підсумок діагностики"
echo "=========================================="
echo ""
echo "Рекомендації:"
echo "  1. Перевірте логи Playwright automation (TEST 5)"
echo "  2. Перевірте помилки синхронізації (TEST 6)"
echo "  3. Якщо Chromium не знайдено - зробіть rebuild контейнера"
echo "  4. Перевірте доступність веб-інтерфейсу MediaSense"
echo ""
echo "Для детального збору логів використайте:"
echo "  sudo ./collect-mediasense-logs.sh"
echo ""
