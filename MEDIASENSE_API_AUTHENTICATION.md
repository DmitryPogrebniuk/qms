# MediaSense API Authentication - Документація та виправлення

## Знайдена інформація про MediaSense API

### 1. Автентифікація

MediaSense використовує Java-based веб-додаток, який підтримує кілька методів автентифікації:

#### Метод 1: Java Form-Based Authentication (`/j_security_check`)

Це стандартний Java servlet endpoint для form-based автентифікації:

```
POST /j_security_check
Content-Type: application/x-www-form-urlencoded

j_username=<username>&j_password=<password>
```

**Очікувана відповідь:**
- HTTP 302 (Redirect) при успішній автентифікації
- `Set-Cookie: JSESSIONID=...` в headers
- Cookie потрібно зберігати та використовувати для подальших запитів

**Переваги:**
- Стандартний Java метод
- Надійно працює з JSESSIONID
- Підтримується більшістю версій MediaSense

#### Метод 2: REST API Login (`/ora/authenticationService/authentication/login`)

```
POST /ora/authenticationService/authentication/login
Content-Type: application/json

{
  "username": "...",
  "password": "..."
}
```

**Проблема:** Деякі версії MediaSense можуть повертати помилку "Invalid session" навіть при HTTP 200.

#### Метод 3: Basic Auth

```
GET /ora/serviceInfo
Authorization: Basic <base64(username:password)>
```

**Проблема:** Працює для деяких endpoints, але не повертає JSESSIONID для query endpoints.

### 2. Query Sessions Endpoint

```
POST /ora/queryService/query/sessions
Content-Type: application/json
Cookie: JSESSIONID=...

{
  "queryType": "sessions",
  "conditions": [
    {
      "field": "sessionEndTime",
      "operator": "gte",
      "value": "2026-01-18T19:00:00.000Z"
    },
    {
      "field": "sessionEndTime",
      "operator": "lte",
      "value": "2026-01-25T19:00:00.000Z"
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

**Важливо:** Query endpoints **вимагають JSESSIONID cookie**, Basic Auth не працює.

## Виправлення в коді

### 1. Додано підтримку `/j_security_check`

Код тепер спробує:
1. **Спочатку** `/j_security_check` (form-based auth)
2. **Потім** `/ora/authenticationService/authentication/login` з Basic Auth
3. **Нарешті** Basic Auth на `/ora/serviceInfo` (fallback)

### 2. Правильна обробка cookies

- Зберігаємо всі cookies з відповіді
- Використовуємо JSESSIONID для всіх query запитів
- Автоматично повторюємо автентифікацію при помилці сесії

## Посилання на документацію

- **Cisco MediaSense Developer Guide**: 
  - Release 11.0: https://www.cisco.com/c/en/us/td/docs/voice_ip_comm/cust_contact/contact_center/mediasense/11/Documentation_Guide/CUMS_BK_P05FD644_00_cisco-mediasense-documentation-guide_11.html
  - Посилання на Developer Guide: http://www.cisco.com/c/en/us/support/customer-collaboration/mediasense/products-programming-reference-guides-list.html

- **Troubleshooting Tips**: 
  - http://docwiki.cisco.com/wiki/Troubleshooting_Tips_for_Cisco_MediaSense

## Рекомендації

1. **Спочатку спробуйте `/j_security_check`** - це найнадійніший метод
2. **Перевірте версію MediaSense** - різні версії можуть мати різні endpoints
3. **Використовуйте JSESSIONID cookie** для всіх query запитів
4. **Перевірте логи MediaSense сервера** - можуть бути додаткові підказки

## Тестування

Після оновлення коду:

```bash
cd /opt/qms
sudo git pull origin main
sudo docker compose -f infra/docker-compose.yml restart api
```

Перевірте логи:
```bash
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "mediasense.*login\|mediasense.*j_security" | tail -30
```

Шукайте:
- `Login successful (j_security_check)` - успішна автентифікація через form-based метод
- `JSESSIONID` в логах - підтвердження отримання cookie
- `Invalid session detected` - якщо все одно є проблеми
