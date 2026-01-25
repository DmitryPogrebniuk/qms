# Виправлення помилки "Invalid session" в MediaSense API

## Проблема

При тестуванні MediaSense API виявлено, що:
- HTTP запити повертають статус 200
- Але в body відповіді є помилка: `{"responseMessage": "Failure: Invalid session. The session may have expired. Sign in again or enter a valid JSESSIONID.", "responseCode":4021}`

## Причина

MediaSense API вимагає **JSESSIONID cookie** для query endpoints (`/ora/queryService/query/sessions`), але:
1. Basic Auth на `/ora/serviceInfo` працює, але не повертає JSESSIONID
2. Query endpoints не працюють тільки з Basic Auth - потрібен JSESSIONID

## Виправлення

### 1. Оновлено автентифікацію

Код тепер:
- **Спочатку намагається отримати JSESSIONID** через POST `/ora/authenticationService/authentication/login` з Basic Auth
- **Якщо не працює**, пробує Basic Auth на `/ora/serviceInfo` і перевіряє, чи повертається JSESSIONID
- **Логує попередження**, якщо JSESSIONID не отримано

### 2. Додано перевірку помилок в body

Навіть якщо HTTP статус 200, код тепер:
- **Перевіряє `responseCode` в body** відповіді
- **Виявляє помилку 4021** (Invalid session)
- **Автоматично пере-логінюється** при помилці сесії
- **Повторює запит** після пере-логіну

### 3. Покращено використання cookies

- **Пріоритет JSESSIONID cookie** - використовується перш за все
- **Правильне форматування Cookie header** - `Cookie: JSESSIONID=...`
- **Fallback на Basic Auth** тільки якщо JSESSIONID недоступний

## Як перевірити

### 1. Оновіть код на сервері

```bash
cd /opt/qms
sudo git pull origin main
sudo docker compose -f infra/docker-compose.yml restart api
```

### 2. Запустіть оновлений тестовий скрипт

```bash
sudo chmod +x test-mediasense-api.sh
sudo ./test-mediasense-api.sh
```

Оновлений скрипт тепер:
- Перевіряє отримання JSESSIONID з login endpoint
- Тестує запити з JSESSIONID cookie
- Виявляє помилки "Invalid session" навіть при HTTP 200

### 3. Перевірте логи API

```bash
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "mediasense.*login\|mediasense.*session\|mediasense.*JSESSIONID" | tail -50
```

Шукайте:
- `Login successful` з JSESSIONID
- `Invalid session detected, attempting re-login`
- `Alternative login successful (JSESSIONID from ...)`

### 4. Перевірте синхронізацію

```bash
sudo ./check-sync-status.sh
```

Після виправлення `totalFetched` має бути > 0.

## Можливі проблеми

### Проблема 1: Login endpoint не повертає JSESSIONID

**Симптоми:**
- `Login returned 200 but no JSESSIONID cookie`
- `Basic Auth works but no JSESSIONID - query endpoints may fail`

**Рішення:**
Можливо, потрібен інший формат запиту до login endpoint. Перевірте в логах, який endpoint працює.

### Проблема 2: JSESSIONID отримано, але все одно помилка 4021

**Симптоми:**
- JSESSIONID є в логах
- Але все одно `Invalid session` при query

**Рішення:**
- Можливо, JSESSIONID застарів - перевірте, чи автоматичний re-login працює
- Можливо, потрібно використовувати JSESSIONID з іншого endpoint

### Проблема 3: Basic Auth працює для serviceInfo, але не для query

**Симптоми:**
- `/ora/serviceInfo` працює з Basic Auth
- `/ora/queryService/query/sessions` не працює

**Рішення:**
Це очікувана поведінка - query endpoints вимагають JSESSIONID. Код тепер має автоматично отримувати JSESSIONID.

## Додаткові кроки

Якщо проблема залишається:

1. **Перевірте MediaSense версію** - різні версії можуть мати різні endpoints
2. **Перевірте документацію MediaSense** - можливо, є інший спосіб отримання JSESSIONID
3. **Перевірте логи MediaSense сервера** - можливо, там є додаткова інформація про помилки

## Очікуваний результат

Після виправлення:
- ✅ Login endpoint повертає JSESSIONID
- ✅ Query запити використовують JSESSIONID cookie
- ✅ Автоматичний re-login при помилці сесії
- ✅ `totalFetched > 0` в синхронізації
