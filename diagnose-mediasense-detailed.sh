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
CONFIG=$(sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U qms -d qms -t -c "SELECT settings::text FROM \"IntegrationSetting\" WHERE \"integrationType\" = 'mediasense' LIMIT 1" 2>/dev/null | tr -d ' ')

if [ -z "$CONFIG" ] || [ "$CONFIG" = "" ]; then
  echo "[ERROR] MediaSense не налаштовано в БД"
  exit 1
fi

# Extract config values (basic parsing)
API_URL=$(echo "$CONFIG" | grep -o '"apiUrl":"[^"]*"' | cut -d'"' -f4 || echo "")
API_USER=$(echo "$CONFIG" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4 || echo "")
API_PASS=$(echo "$CONFIG" | grep -o '"apiSecret":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -z "$API_URL" ] || [ -z "$API_USER" ] || [ -z "$API_PASS" ]; then
  echo "[ERROR] Не вдалося отримати конфігурацію"
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
