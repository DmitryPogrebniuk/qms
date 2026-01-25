# MediaSense API - Повна документація та рекомендації

## Статус продукту

**Cisco MediaSense досяг End of Life:**
- **Announcement:** April 5, 2017
- **End of Sale:** October 4, 2017
- **End of Software Maintenance:** October 4, 2018
- **End of Software Support:** October 31, 2020
- **Остання версія:** 11.5 (без нових функцій)

**Важливо:** Офіційна підтримка Cisco більше не доступна. Документація доступна в архівному вигляді.

## Офіційна документація (архівна)

### 1. Developer Guide (Основна документація API)

**Посилання:**
- **Release 11.0:** https://www.cisco.com/c/en/us/td/docs/voice_ip_comm/cust_contact/contact_center/mediasense/11/Documentation_Guide/CUMS_BK_P05FD644_00_cisco-mediasense-documentation-guide_11.html
- **Всі гіди:** http://www.cisco.com/c/en/us/support/customer-collaboration/mediasense/products-programming-reference-guides-list.html

**Що містить:**
- Огляд MediaSense
- Введення в розробку MediaSense додатків
- **Формат та використання MediaSense Application Programming Interface (API)**
- Призначений для системних інтеграторів та розробників

### 2. User Guide

**Посилання:**
- Release 10.0: https://www.cisco.com/en/US/docs/voice_ip_comm/cust_contact/contact_center/mediasense/10/user_guide/CUMS_BK_MCD100EE_00_ms-user-guide-10.html

**Що містить:**
- Встановлення, налаштування, конфігурація
- Обслуговування та усунення неполадок
- Потрібен досвід роботи з Java

### 3. Solution Reference Network Design Guide

**Що містить:**
- Розділ про "Metadata database and the MediaSense API"
- Архітектура та дизайн системи

### 4. Troubleshooting Resources

- **Troubleshooting Tips Wiki:** http://docwiki.cisco.com/wiki/Troubleshooting_Tips_for_Cisco_MediaSense
  - Категорії: API, Administration, Configuration, Database, General, Installation, Upgrade, Recording, RTMT, Runtime
- **Community Discussions:** https://community.cisco.com/t5/management/issues-while-downloading-recorded-sessions-using-mediasense/td-p/3605459

## Автентифікація MediaSense API

### Ключова інформація про JSESSIONIDSSO

**Важливо:** MediaSense використовує **JSESSIONIDSSO** (не просто JSESSIONID)!

Згідно з документацією та форумами Cisco:
- При Basic Auth сервер повертає cookie **JSESSIONIDSSO** (не JSESSIONID)
- Формат: `Cookie: JSESSIONIDSSO=<session-token>; Path=/; Secure; HttpOnly`
- Цей cookie можна використовувати замість Authorization header для подальших запитів
- **Query endpoints вимагають JSESSIONIDSSO cookie**, Basic Auth не працює для них

### Методи автентифікації

#### 1. Java Form-Based Authentication (`/j_security_check`)

```
POST /j_security_check
Content-Type: application/x-www-form-urlencoded

j_username=<username>&j_password=<password>
```

**Очікувана відповідь:**
- HTTP 302 (Redirect) при успішній автентифікації
- `Set-Cookie: JSESSIONIDSSO=...` або `Set-Cookie: JSESSIONID=...` в headers
- Cookie потрібно зберігати та використовувати для подальших запитів

**Переваги:**
- Стандартний Java метод
- Надійно працює з JSESSIONIDSSO
- Підтримується більшістю версій MediaSense

#### 2. REST API Login (`/ora/authenticationService/authentication/login`)

```
POST /ora/authenticationService/authentication/login
Content-Type: application/json
Authorization: Basic <base64(username:password)>

{
  "username": "...",
  "password": "..."
}
```

**Проблема:** Деякі версії MediaSense можуть повертати помилку "Invalid session" (`responseCode: 4021`) навіть при HTTP 200, якщо не встановлюється JSESSIONIDSSO cookie.

#### 3. Basic Auth на Service Info

```
GET /ora/serviceInfo
Authorization: Basic <base64(username:password)>
```

**Проблема:** Працює для деяких endpoints, але **не повертає JSESSIONIDSSO для query endpoints**.

### Порти MediaSense

**Важливо:** MediaSense використовує різні порти для різних операцій:
- **Порт 8440**: API автентифікація та запити
- **Порт 8081**: Доступ до медіа файлів (recordings)

**Проблема:** 401 Unauthorized може виникати при доступі до записів на порту 8081, якщо автентифікація була на порту 8440.

## Query Sessions Endpoint

### Формат запиту

```
POST /ora/queryService/query/sessions
Content-Type: application/json
Cookie: JSESSIONIDSSO=<session-token>

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
- Query endpoints **вимагають JSESSIONIDSSO cookie**, Basic Auth не працює
- Використовуйте `sessionEndTime` для фільтрації (більш надійно, ніж `sessionStartTime`)

### Формат відповіді

```
HTTP 200 OK
Content-Type: application/json

{
  "responseCode": 2000,
  "responseMessage": "Success",
  "responseBody": {
    "sessions": [
      {
        "sessionId": "...",
        "startTime": "2025-01-18T10:00:00.000Z",
        "endTime": "2025-01-18T10:15:00.000Z",
        ...
      }
    ],
    "totalCount": 100,
    "hasMore": false
  }
}
```

**Коди відповіді:**
- `2000` - Success
- `4021` - Invalid session (потрібна повторна автентифікація)
- Інші коди - помилки API

## Проблеми та рішення

### Проблема 1: JSESSIONIDSSO не отримується

**Симптоми:**
- HTTP 200 при логіні, але `Set-Cookie` заголовки відсутні
- Запити до query endpoints повертають `responseCode: 4021`

**Можливі причини:**
1. MediaSense не встановлює cookie при Basic Auth
2. Неправильний endpoint для автентифікації
3. Версія MediaSense не підтримує cookie-based автентифікацію
4. Конфігурація на сервері MediaSense блокує встановлення cookies

**Рішення:**
1. Спробуйте `/j_security_check` замість REST API login
2. Перевірте версію MediaSense
3. Перевірте конфігурацію сервера MediaSense
4. Використовуйте прямі HTTP запити для діагностики

### Проблема 2: Invalid session (responseCode: 4021)

**Симптоми:**
- HTTP 200, але `responseCode: 4021` в body
- Повідомлення: "Invalid session. The session may have expired. Sign in again or enter a valid JSESSIONID."

**Можливі причини:**
1. JSESSIONIDSSO не отримано або не передано в запиті
2. Сесія закінчилася
3. Cookie не правильно сформований

**Рішення:**
1. Переконайтеся, що JSESSIONIDSSO отримано при логіні
2. Перевірте, що cookie передається в заголовку `Cookie: JSESSIONIDSSO=...`
3. Реалізуйте автоматичну повторну автентифікацію при помилці 4021

### Проблема 3: Basic Auth не працює для query endpoints

**Симптоми:**
- Basic Auth працює для `/ora/serviceInfo`
- Basic Auth не працює для `/ora/queryService/query/sessions`

**Рішення:**
- Query endpoints **вимагають JSESSIONIDSSO cookie**
- Отримайте cookie через `/j_security_check` або `/ora/authenticationService/authentication/login`
- Використовуйте cookie для всіх query запитів

## Рекомендації для коду

### 1. Пріоритет методів автентифікації

```typescript
// 1. Спробувати /j_security_check (найнадійніший)
// 2. Спробувати POST /ora/authenticationService/authentication/login
// 3. Fallback до Basic Auth на /ora/serviceInfo
```

### 2. Обробка JSESSIONIDSSO

```typescript
private extractJSessionId(cookies: string[]): string | null {
  for (const cookie of cookies) {
    // Спочатку шукати JSESSIONIDSSO (MediaSense специфічний)
    const ssoMatch = cookie.match(/JSESSIONIDSSO\s*=\s*([^;\s,]+)/i);
    if (ssoMatch && ssoMatch[1]) {
      return ssoMatch[1].trim();
    }
    // Fallback на стандартний JSESSIONID
    const match = cookie.match(/JSESSIONID\s*=\s*([^;\s,]+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}
```

### 3. Використання cookie в заголовках

```typescript
private getSessionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  
  if (this.session && this.session.cookies.length > 0) {
    const jsessionId = this.extractJSessionId(this.session.cookies);
    if (jsessionId) {
      // Використовувати JSESSIONIDSSO якщо доступний, інакше JSESSIONID
      const cookieName = this.session.cookies.some(c => 
        c.includes('JSESSIONIDSSO')
      ) ? 'JSESSIONIDSSO' : 'JSESSIONID';
      
      headers['Cookie'] = `${cookieName}=${jsessionId}`;
      // Також включити Basic Auth як fallback
      headers['Authorization'] = `Basic ${this.getBasicAuth()}`;
      return headers;
    }
  }
  
  // Fallback до Basic Auth
  headers['Authorization'] = `Basic ${this.getBasicAuth()}`;
  return headers;
}
```

### 4. Обробка помилки 4021

```typescript
if (responseCode === 4021) {
  // Очистити невалідну сесію
  this.session = null;
  // Повторна автентифікація
  await this.login();
  // Повторити запит
  return this.request(method, path, body, options);
}
```

## Діагностика

### Скрипти для діагностики

1. **`diagnose-mediasense-auth.sh`** - перевірка автентифікації
2. **`test-mediasense-query.sh`** - тест запитів з JSESSIONIDSSO
3. **`test-mediasense-api.sh`** - комплексний тест API

### Що перевірити

1. Чи отримується JSESSIONIDSSO при логіні
2. Чи правильно передається cookie в запитах
3. Чи правильні дати (не майбутні)
4. Чи правильний формат запиту до query endpoint

## Альтернативні підходи

Якщо JSESSIONIDSSO не працює:

1. **Перевірте версію MediaSense** - різні версії мають різні API
2. **Використовуйте веб-інтерфейс MediaSense** - можливо, там є підказки про правильну автентифікацію
3. **Перевірте логи MediaSense сервера** - можуть бути додаткові підказки
4. **Спробуйте інші endpoints** - можливо, є альтернативні методи доступу до даних

## Посилання

- **Developer Guide (Release 11.0):** https://www.cisco.com/c/en/us/td/docs/voice_ip_comm/cust_contact/contact_center/mediasense/11/Documentation_Guide/CUMS_BK_P05FD644_00_cisco-mediasense-documentation-guide_11.html
- **Troubleshooting Wiki:** http://docwiki.cisco.com/wiki/Troubleshooting_Tips_for_Cisco_MediaSense
- **Community Forums:** https://community.cisco.com/t5/management/issues-while-downloading-recorded-sessions-using-mediasense/td-p/3605459
- **End of Life FAQ:** https://community.cisco.com/t5/collaboration-knowledge-base/cisco-mediasense-end-of-life-faq/ta-p/3636105
