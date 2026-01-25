# MediaSense API Integration - Support Request

## Проблема

MediaSense API повертає помилку "Invalid session" (`responseCode: 4021`) при спробі виконати запити до `/ora/queryService/query/sessions`, навіть коли HTTP статус код `200 OK`. Основна причина - не вдається отримати `JSESSIONID` cookie при автентифікації.

## Деталі проблеми

### 1. Автентифікація не встановлює JSESSIONID

**Тест 1: POST /ora/authenticationService/authentication/login**
- HTTP Status: `200 OK`
- Request: `POST /ora/authenticationService/authentication/login` з Basic Auth header та JSON body `{"username":"...","password":"..."}`
- Response: `{"responseCode":4021, "responseMessage":"Failure: Invalid session..."}`
- **Set-Cookie заголовки: ВІДСУТНІ**
- **JSESSIONID в cookies: НЕ ЗНАЙДЕНО**

**Тест 2: GET /ora/serviceInfo**
- HTTP Status: `200 OK`
- Request: `GET /ora/serviceInfo` з Basic Auth header
- **Set-Cookie заголовки: ВІДСУТНІ**
- **JSESSIONID в cookies: НЕ ЗНАЙДЕНО**

### 2. Запити до query endpoints повертають Invalid session

**Тест: POST /ora/queryService/query/sessions**
- HTTP Status: `200 OK`
- Request: З Basic Auth header (JSESSIONID відсутній)
- Response: `{"responseCode":4021, "responseMessage":"Failure: Invalid session. The session may have expired. Sign in again or enter a valid JSESSIONID."}`
- **Результат: Запит відхилено через відсутність валідної сесії**

### 3. Спробовані методи автентифікації

1. ✅ `POST /ora/authenticationService/authentication/login` з Basic Auth + JSON body
2. ✅ `GET /ora/serviceInfo` з Basic Auth
3. ❌ `POST /j_security_check` (повертає 404 - endpoint недоступний)
4. ✅ `POST /ora/authenticationService/authentication/login` з Basic Auth + empty body

Всі методи повертають HTTP 200, але **жоден не встановлює JSESSIONID cookie**.

## Конфігурація

- **MediaSense URL**: `https://192.168.200.133:8440`
- **Username**: `dpogrebnyuk`
- **Port**: `8440` (HTTPS)
- **Self-signed certificates**: Дозволені (`allowSelfSigned: true`)

## Очікувана поведінка

Згідно з документацією Cisco MediaSense:
1. Автентифікація має повертати `JSESSIONID` або `JSESSIONIDSSO` cookie в заголовку `Set-Cookie`
2. Цей cookie має використовуватися для подальших запитів до query endpoints
3. Basic Auth може працювати для деяких endpoints, але query endpoints вимагають валідної сесії

## Фактична поведінка

1. Автентифікація повертає HTTP 200, але не встановлює cookie
2. Запити з Basic Auth до query endpoints повертають `responseCode: 4021`
3. Неможливо отримати дані через API без валідної сесії

## Питання для підтримки Cisco MediaSense

1. **Який правильний метод автентифікації для отримання JSESSIONID?**
   - Чи потрібен інший endpoint?
   - Чи потрібен інший формат запиту?
   - Чи потрібні додаткові параметри?

2. **Чи підтримує ця версія MediaSense Basic Auth для query endpoints?**
   - Якщо ні, який метод автентифікації використовувати?

3. **Чи є обмеження на IP/порт для автентифікації?**
   - Чи потрібна спеціальна конфігурація на сервері MediaSense?

4. **Яка версія MediaSense використовується?**
   - Як перевірити версію через API?

## Діагностичні дані

### Логи з додатку

```
[Mediasense] [INFO] [ms-...] Attempting Mediasense login
[Mediasense] [INFO] [ms-...-alt] Alternative login successful (Basic Auth)
```

**Примітка**: "Alternative login successful" означає лише те, що HTTP запит успішний, але JSESSIONID не отримано.

### Прямі HTTP запити (curl)

```bash
# POST /ora/authenticationService/authentication/login
curl -k -i -u "user:pass" \
  -X POST "https://192.168.200.133:8440/ora/authenticationService/authentication/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass"}'

# Результат: HTTP 200, але Set-Cookie відсутній
```

## Код інтеграції

Використовується NestJS з axios для HTTP запитів. Код намагається:
1. Отримати JSESSIONID при логіні
2. Використовувати cookie для подальших запитів
3. Fallback до Basic Auth, якщо cookie недоступний

**Проблема**: Cookie ніколи не отримується, тому всі запити використовують Basic Auth, який не працює для query endpoints.

## Наступні кроки

1. ✅ Створено діагностичні скрипти для перевірки автентифікації
2. ✅ Виправлено обробку Set-Cookie заголовків в axios (Node.js)
3. ⏳ Очікується відповідь від підтримки Cisco MediaSense
4. ⏳ Можливо потрібна конфігурація на сервері MediaSense
5. ⏳ Можливо потрібен інший метод автентифікації

## Виправлення в коді

Додано правильну обробку Set-Cookie заголовків в axios для Node.js:
- Axios в Node.js може повертати Set-Cookie як масив або рядок
- Додано нормалізацію заголовків перед парсингом
- Покращено регулярні вирази для витягування JSESSIONID

## Файли для діагностики

- `diagnose-mediasense-auth.sh` - перевірка автентифікації
- `test-mediasense-query.sh` - тест запитів з JSESSIONID
- `apps/api/src/modules/media-sense/media-sense-client.service.ts` - код клієнта
