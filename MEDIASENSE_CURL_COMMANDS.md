# Curl-команди для інтеграції з MediaSense

Документ збирає всі **curl**-команди, присутні в проекті для роботи з Cisco MediaSense та з QMS API (інтеграція MediaSense).  
Версія MediaSense: **11.5.1.12001-8**. Порт API: **8440** (HTTPS).

---

## 1. Прямі запити до MediaSense API

Виконуються напряму до сервера MediaSense (`https://HOST:8440`).  
`-k` — ігнорування помилок самопідписаного сертифіката.

### 1.1. Перевірка доступності веб-інтерфейсу

**Опис:** Перевірка, чи відповідає MediaSense на кореневому URL (логін-сторінка).

```bash
curl -k -s -o /dev/null -w "%{http_code}" "https://192.168.200.133:8440/" --max-time 10
```

**Очікувано:** HTTP 200, 302 або 401.

---

### 1.2. Інформація про сервіс (Service Info)

**Опис:** Перевірка доступності API та базової автентифікації. Не встановлює JSESSIONID; для query-ендпоінтів потрібен cookie.

```bash
curl -k -u "admin:password" "https://192.168.200.133:8440/ora/serviceInfo" \
  -H "Content-Type: application/json"
```

**Альтернатива (verbose):**
```bash
curl -k -v -u "user:pass" "https://192.168.200.133:8440/ora/serviceInfo"
```

---

### 1.3. Java form-based автентифікація (j_security_check)

**Опис:** Спроба отримати JSESSIONID через форму логіну. У частини інсталяцій MediaSense не повертає Set-Cookie при виклику з curl.

```bash
curl -k -s -i -X POST "https://192.168.200.133:8440/j_security_check" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "j_username=admin&j_password=password" \
  --max-time 15
```

**З збереженням cookies у файл:**
```bash
curl -k -c cookies.txt -b cookies.txt \
  -X POST "https://192.168.200.133:8440/j_security_check" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "j_username=admin&j_password=password"
```

**Очікувано:** HTTP 200 або 302; перевірити заголовки `Set-Cookie` на наявність JSESSIONID.

---

### 1.4. REST API логін

**Опис:** Логін через REST endpoint. Часто повертає 200 та `responseCode: 2000`, але без встановлення JSESSIONID у відповіді.

```bash
AUTH=$(echo -n "admin:password" | base64)
curl -k -s -i -X POST "https://192.168.200.133:8440/ora/authenticationService/authentication/login" \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"username":"admin","password":"password"}' \
  --max-time 15
```

**Очікувано:** HTTP 200; тіло може містити `responseCode: 2000`. Set-Cookie часто відсутній.

---

### 1.5. Отримання списку сесій (getSessions) — основний робочий endpoint

**Опис:** Запит списку записів за діапазоном дат. **Працює лише з валідним JSESSIONID** (отриманим, наприклад, з веб-інтерфейсу або Playwright). Basic Auth без cookie для цього endpoint повертає `responseCode: 4021` (Invalid session).

Формат тіла — **MediaSense 11.5**: `requestParameters`, timestamps у **мілісекундах**, `sessionStartDate`, `sessionState` (CLOSED_NORMAL, CLOSED_ERROR).

```bash
# Підставте реальний JSESSIONID з браузера або cookie-сервісу
curl -k -X POST "https://192.168.200.133:8440/ora/queryService/query/getSessions" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Cookie: JSESSIONID=0683BFCE250C6380CF68D66DF21E5DD2" \
  -H "Authorization: Basic $(echo -n 'admin:password' | base64)" \
  -d '{
    "requestParameters": [
      {
        "fieldName": "sessionState",
        "fieldConditions": [
          {"fieldOperator": "equals", "fieldValues": ["CLOSED_NORMAL"], "fieldConnector": "OR"},
          {"fieldOperator": "equals", "fieldValues": ["CLOSED_ERROR"]}
        ],
        "paramConnector": "AND"
      },
      {
        "fieldName": "sessionStartDate",
        "fieldConditions": [
          {"fieldOperator": "between", "fieldValues": [1768771615694, 1769376415694]}
        ]
      }
    ]
  }'
```

**Примітка:** Значення в `fieldValues` для `sessionStartDate` — Unix timestamp у мілісекундах (початок і кінець діапазону).

**Успішна відповідь:** `responseCode: 2000`, у `responseBody.sessions` — масив сесій з полями `sessionId`, `sessionStartDate`, `sessionDuration`, `urls`, `tracks`, тощо.

---

### 1.6. Альтернативний формат запиту сесій (старий/документований)

**Опис:** Формат з `queryType`, `conditions`, `sessionEndTime` — може підтримуватися в інших версіях або не підтримуватися (404). У 11.5.1.12001-8 робочий endpoint — `getSessions` (див. 1.5).

```bash
curl -k -u admin:password -X POST "https://192.168.200.133:8440/ora/queryService/query/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "queryType": "sessions",
    "conditions": [
      {"field": "sessionEndTime", "operator": "gte", "value": "2025-01-18T00:00:00.000Z"},
      {"field": "sessionEndTime", "operator": "lte", "value": "2025-01-25T00:00:00.000Z"}
    ],
    "paging": {"offset": 0, "limit": 100}
  }'
```

---

## 2. Запити до QMS API (наш бекенд)

Ці запити йдуть до **QMS API** (наприклад, `http://localhost:3000`). Вони використовують інтеграцію з MediaSense всередині сервісу.

### 2.1. Налаштування інтеграції MediaSense

**Опис:** Збереження/оновлення налаштувань MediaSense (URL, логін, пароль, allowSelfSigned). Потрібен JWT у заголовку.

```bash
curl -X PUT http://localhost:3000/api/integrations/mediasense \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "apiUrl": "https://192.168.200.133:8440",
    "apiKey": "admin",
    "apiSecret": "password",
    "allowSelfSigned": true
  }'
```

---

### 2.2. Тест підключення до MediaSense

**Опис:** Перевірка з’єднання з MediaSense: доступність, автентифікація (включно з Playwright/cookie), при потребі — запит до query endpoint.

```bash
curl -X POST http://localhost:3000/api/integrations/mediasense/test \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "apiUrl": "https://192.168.200.133:8440",
    "apiKey": "admin",
    "apiSecret": "password"
  }'
```

---

### 2.3. Запуск синхронізації записів (sync-now)

**Опис:** Одноразовий запуск синхронізації метаданих записів з MediaSense в локальну БД та OpenSearch.

```bash
curl -X POST http://localhost:3000/api/recordings/admin/sync-now \
  -H "Authorization: Bearer $JWT"
```

---

### 2.4. Перегляд логів інтеграції MediaSense

**Опис:** Отримання логів MediaSense-інтеграції (за рівнем та обмеженням кількості записів).

```bash
curl "http://localhost:3000/api/integrations/mediasense/logs?level=ERROR&limit=20" \
  -H "Authorization: Bearer $JWT"
```

---

### 2.5. Стримінг аудіо запису

**Опис:** Проксування аудіопотоку запису з MediaSense через QMS API. `{id}` — ідентифікатор запису в QMS.

```bash
curl "http://localhost:3000/api/recordings/{id}/stream" \
  -H "Authorization: Bearer $JWT" \
  -H "Range: bytes=0-1023" \
  -o audio.wav
```

---

## 3. Діагностика та тестові скрипти

У репозиторії є скрипти, які всередині використовують curl до MediaSense:

| Скрипт | Призначення |
|--------|-------------|
| `test-mediasense-api.sh` | Повний тест: j_security_check, REST login, serviceInfo, запити до query/sessions та getSessions |
| `test-mediasense-query.sh` | Тест запитів до query endpoint з JSESSIONID/Basic Auth |
| `test-mediasense-with-jsessionid.sh` | Запит getSessions з переданим JSESSIONID |
| `test-mediasense-with-all-cookies.sh` | Запит з повним набором cookies |
| `diagnose-mediasense-detailed.sh` | Діагностика: доступність, форма логіну, j_security_check, REST login, логи Playwright |
| `diagnose-mediasense-auth.sh` | Перевірка автентифікації та serviceInfo |
| `diagnose-sync-issue.sh` | Перевірка синхронізації та запитів до MediaSense |
| `collect-mediasense-logs.sh` | Збір логів (включає curl до API та сервісу) |

Конкретні URL та тіла запитів у цих скриптах узгоджені з командами вище (serviceInfo, j_security_check, login, getSessions).

---

## 4. Коротка довідка по endpoints MediaSense (11.5)

| Метод | Шлях | Опис |
|-------|------|------|
| GET | `/ora/serviceInfo` | Інформація про сервіс, перевірка Basic Auth |
| POST | `/j_security_check` | Java form login (j_username, j_password) |
| POST | `/ora/authenticationService/authentication/login` | REST login (JSON body + Basic Auth) |
| POST | `/ora/queryService/query/getSessions` | Список сесій (потрібен JSESSIONID), тіло — requestParameters |
| GET | `/ora/queryService/query/sessionBySessionId/{id}` | Сесія за ID (залежить від версії) |

**Важливо:** Для `getSessions` (та інших query-операцій) у 11.5 потрібен **Cookie: JSESSIONID=...**. Без нього типова відповідь — HTTP 200 з `responseCode: 4021` (Invalid session). JSESSIONID можна отримати через веб-інтерфейс вручну або через Playwright (MediaSenseCookieService у QMS).
