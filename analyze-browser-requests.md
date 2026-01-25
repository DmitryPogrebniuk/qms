# Reverse Engineering MediaSense API - Інструкція

## Метод 1: Аналіз через DevTools браузера

### Крок 1: Відкрийте веб-інтерфейс MediaSense

1. Відкрийте браузер (Chrome/Firefox)
2. Перейдіть до: `https://192.168.200.133:8440`
3. Прийміть самопідписані сертифікати (якщо потрібно)

### Крок 2: Відкрийте DevTools

- **Chrome/Edge**: `F12` або `Ctrl+Shift+I` (Windows/Linux), `Cmd+Option+I` (Mac)
- **Firefox**: `F12` або `Ctrl+Shift+I` (Windows/Linux), `Cmd+Option+I` (Mac)

### Крок 3: Перейдіть до Network tab

1. Відкрийте вкладку **Network** (Мережа)
2. Увімкніть **Preserve log** (Зберегти логи)
3. Очистіть логи (кнопка 🚫)

### Крок 4: Виконайте дії в веб-інтерфейсі

1. **Авторизуйтеся** - увійдіть в систему
2. **Відкрийте сторінку з сесіями/записами**
3. **Виконайте пошук** - спробуйте знайти записи
4. **Перегляньте деталі** - відкрийте деталі запису

### Крок 5: Аналіз запитів

#### Знайдіть запити автентифікації:

Шукайте запити з:
- URL містить: `login`, `auth`, `j_security_check`
- Метод: `POST` або `GET`
- Перевірте **Headers** -> **Request Headers**:
  - `Authorization: Basic ...`
  - `Content-Type: application/x-www-form-urlencoded` (для j_security_check)
- Перевірте **Headers** -> **Response Headers**:
  - `Set-Cookie: JSESSIONIDSSO=...`
  - `Set-Cookie: JSESSIONID=...`

#### Знайдіть query запити:

Шукайте запити з:
- URL містить: `query`, `sessions`, `recordings`
- Метод: `POST` або `GET`
- Перевірте **Headers** -> **Request Headers**:
  - `Cookie: JSESSIONIDSSO=...` або `Cookie: JSESSIONID=...`
  - `Authorization: Basic ...` (якщо є)
- Перевірте **Payload** (для POST):
  - Формат JSON з `queryType`, `conditions`, `paging`

### Крок 6: Експорт HAR файлу

1. Right-click на будь-якому запиті
2. Виберіть **Save all as HAR with content**
3. Збережіть файл (наприклад, `mediasense-requests.har`)

### Крок 7: Аналіз HAR файлу

```bash
# Використайте скрипт для аналізу
./reverse-engineer-mediasense-api.sh mediasense-requests.har
```

## Метод 2: Перехоплення через curl з verbose

### Запис запитів з деталями:

```bash
# Автентифікація
curl -k -v -u "dpogrebnyuk:password" \
  -X POST "https://192.168.200.133:8440/ora/authenticationService/authentication/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"dpogrebnyuk","password":"password"}' \
  2>&1 | tee mediasense-auth.log

# Service Info
curl -k -v -u "dpogrebnyuk:password" \
  -X GET "https://192.168.200.133:8440/ora/serviceInfo" \
  2>&1 | tee mediasense-serviceinfo.log

# Query (якщо є JSESSIONIDSSO)
curl -k -v \
  -X POST "https://192.168.200.133:8440/ora/queryService/query/sessions" \
  -H "Content-Type: application/json" \
  -H "Cookie: JSESSIONIDSSO=YOUR_SESSION_ID" \
  -d '{
    "queryType": "sessions",
    "conditions": [
      {"field": "sessionEndTime", "operator": "gte", "value": "2025-01-01T00:00:00.000Z"},
      {"field": "sessionEndTime", "operator": "lte", "value": "2025-01-25T23:59:59.999Z"}
    ],
    "paging": {"offset": 0, "limit": 10}
  }' \
  2>&1 | tee mediasense-query.log
```

## Метод 3: Перехоплення трафіку через tcpdump

```bash
# Запустіть перехоплення
sudo ./capture-mediasense-traffic.sh

# В іншому терміналі виконайте запити до MediaSense
# Натисніть Ctrl+C для зупинки

# Аналіз
tcpdump -r mediasense-traffic-*.pcap -A -s 0 | grep -i 'cookie\|authorization\|jsessionid'
```

## Метод 4: Використання mitmproxy

```bash
# Встановлення
pip install mitmproxy

# Запуск проксі
mitmproxy -p 8080

# Налаштуйте браузер для використання проксі: localhost:8080
# Всі запити будуть відображатися в mitmproxy
```

## Що шукати

### 1. Автентифікація

- **Endpoint**: `/j_security_check`, `/ora/authenticationService/authentication/login`, `/ora/serviceInfo`
- **Метод**: `POST` або `GET`
- **Headers**: `Authorization: Basic ...`, `Content-Type`
- **Cookies**: `Set-Cookie: JSESSIONIDSSO=...` або `Set-Cookie: JSESSIONID=...`

### 2. Query запити

- **Endpoint**: `/ora/queryService/query/sessions`
- **Метод**: `POST`
- **Headers**: `Cookie: JSESSIONIDSSO=...`, `Content-Type: application/json`
- **Body**: JSON з `queryType`, `conditions`, `paging`

### 3. Формат відповіді

- **Success**: `{"responseCode": 2000, "responseMessage": "Success", "responseBody": {...}}`
- **Error**: `{"responseCode": 4021, "responseMessage": "Invalid session", ...}`

## Аналіз JavaScript коду веб-інтерфейсу

1. Відкрийте **Sources** tab в DevTools
2. Знайдіть JavaScript файли MediaSense
3. Шукайте:
   - `fetch()`, `XMLHttpRequest`, `axios` виклики
   - URL endpoints
   - Формати запитів
   - Обробку cookies

## Створення тестових запитів

Після аналізу, створіть тестові запити:

```bash
# 1. Отримайте JSESSIONIDSSO з браузера
# 2. Використайте його в curl

curl -k -X POST "https://192.168.200.133:8440/ora/queryService/query/sessions" \
  -H "Content-Type: application/json" \
  -H "Cookie: JSESSIONIDSSO=COPIED_FROM_BROWSER" \
  -d '{
    "queryType": "sessions",
    "conditions": [
      {"field": "sessionEndTime", "operator": "gte", "value": "2025-01-01T00:00:00.000Z"},
      {"field": "sessionEndTime", "operator": "lte", "value": "2025-01-25T23:59:59.999Z"}
    ],
    "paging": {"offset": 0, "limit": 10}
  }'
```

## Очікувані результати

Після аналізу ви маєте знати:

1. **Який endpoint використовується для автентифікації**
2. **Як отримується JSESSIONIDSSO** (якщо він отримується)
3. **Який формат запиту для query endpoints**
4. **Які заголовки потрібні**
5. **Як обробляються cookies**

## Наступні кроки

Після збору інформації:

1. Оновіть код в `media-sense-client.service.ts`
2. Додайте знайдені endpoints
3. Виправте формат запитів
4. Протестуйте з реальними даними
