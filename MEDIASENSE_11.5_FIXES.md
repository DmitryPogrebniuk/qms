# Виправлення для MediaSense 11.5.1.12001-8

## Оновлення коду

Код оновлено для правильної роботи з MediaSense версії 11.5.1.12001-8 згідно з документацією Cisco MediaSense Developer Guide Release 11.0+.

## Основні зміни

### 1. Автентифікація

#### Пріоритет методів автентифікації (для версії 11.5):

1. **`/j_security_check`** (Java form-based) - **основний метод для 11.5**
   - Додано правильні заголовки: `Accept`, `User-Agent`
   - Покращено обробку cookies (JSESSIONIDSSO має пріоритет)
   - Додано детальне логування для діагностики

2. **`POST /ora/authenticationService/authentication/login`** з Basic Auth
   - Додано заголовки `Content-Type` та `Accept`
   - Покращено обробку відповідей
   - Додано детальне логування відсутності cookies

3. **`GET /ora/serviceInfo`** з Basic Auth (fallback)
   - Додано заголовок `Accept`

### 2. Обробка JSESSIONIDSSO

Для MediaSense 11.5 використовується **JSESSIONIDSSO** (не JSESSIONID):

```typescript
// Пріоритет: JSESSIONIDSSO > JSESSIONID
const cookieType = cookies.some(c => c.includes('JSESSIONIDSSO')) 
  ? 'JSESSIONIDSSO' 
  : 'JSESSIONID';
```

### 3. Заголовки для запитів

Додано правильні заголовки для MediaSense 11.5:

- **Для автентифікації:**
  - `Content-Type: application/x-www-form-urlencoded` (для j_security_check)
  - `Content-Type: application/json` (для REST API login)
  - `Accept: application/json`
  - `User-Agent: MediaSense-API-Client/1.0`

- **Для query endpoints:**
  - `Content-Type: application/json`
  - `Accept: application/json`
  - `Cookie: JSESSIONIDSSO=...` або `Cookie: JSESSIONID=...`
  - `Authorization: Basic ...` (як fallback)

### 4. Query Sessions Endpoint

Для MediaSense 11.5 використовується:

```
POST /ora/queryService/query/sessions
Content-Type: application/json
Cookie: JSESSIONIDSSO=<session-token>
Authorization: Basic <base64(username:password)>

{
  "queryType": "sessions",
  "conditions": [
    {
      "field": "sessionEndTime",
      "operator": "gte",
      "value": "2025-01-18T00:00:00.000Z"
    },
    {
      "field": "sessionEndTime",
      "operator": "lte",
      "value": "2025-01-25T00:00:00.000Z"
    }
  ],
  "sorting": [
    { "field": "sessionEndTime", "order": "asc" }
  ],
  "paging": {
    "offset": 0,
    "limit": 100
  }
}
```

**Важливо:**
- Використовується `sessionEndTime` для фільтрації (більш надійно)
- Query endpoints **вимагають JSESSIONIDSSO cookie**
- Basic Auth використовується як fallback

### 5. Покращене логування

Додано детальне логування для діагностики:

- Тип cookie (JSESSIONIDSSO або JSESSIONID)
- Деталі відповіді при відсутності cookie
- Інформація про query запити
- Деталі помилок автентифікації

## Очікувана поведінка

### Успішна автентифікація:

1. **j_security_check** повертає HTTP 302 або 200 з `Set-Cookie: JSESSIONIDSSO=...`
2. Cookie зберігається та використовується для подальших запитів
3. Query endpoints працюють з JSESSIONIDSSO cookie

### Проблеми та рішення:

1. **Cookie не отримується:**
   - Перевірте логи - детальна інформація про відповіді
   - Спробуйте інші методи автентифікації
   - Перевірте конфігурацію MediaSense сервера

2. **Invalid session (4021):**
   - Автоматична повторна автентифікація
   - Перевірте, чи правильно передається cookie
   - Перевірте термін дії сесії (30 хвилин)

## Тестування

Після оновлення коду:

1. Перезапустіть API:
   ```bash
   sudo docker compose -f infra/docker-compose.yml restart api
   ```

2. Перевірте логи автентифікації:
   ```bash
   sudo docker compose -f infra/docker-compose.yml logs api | grep -i "mediasense.*login" | tail -20
   ```

3. Перевірте статус синхронізації:
   ```bash
   sudo ./check-sync-status.sh
   ```

4. Запустіть діагностику:
   ```bash
   sudo ./diagnose-mediasense-auth.sh
   ```

## Посилання на документацію

- **Cisco MediaSense Developer Guide Release 11.0+**: 
  https://www.cisco.com/c/en/us/td/docs/voice_ip_comm/cust_contact/contact_center/mediasense/11/Documentation_Guide/CUMS_BK_P05FD644_00_cisco-mediasense-documentation-guide_11.html

- **MEDIASENSE_API_DOCUMENTATION_COMPLETE.md** - повна документація

## Версія

- **MediaSense:** 11.5.1.12001-8
- **Код оновлено:** 2025-01-25
- **Базується на:** Cisco MediaSense Developer Guide Release 11.0+
