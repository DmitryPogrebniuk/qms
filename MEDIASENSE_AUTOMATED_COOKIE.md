# MediaSense - Автоматичне отримання JSESSIONID через веб-інтерфейс

**Дата:** 26 січня 2026  
**Статус:** ✅ Реалізовано

---

## Огляд

Реалізовано автоматичне отримання JSESSIONID cookie з веб-інтерфейсу MediaSense за допомогою Playwright (headless browser automation). Це рішення обходить проблему, коли MediaSense API не встановлює cookies при прямих API викликах.

---

## Як це працює

### Процес автентифікації

1. **Спроба API автентифікації** (першочергово)
   - `POST /j_security_check` (Java form-based auth)
   - `POST /ora/authenticationService/authentication/login` (REST API)
   - `GET /ora/serviceInfo` (Basic Auth)

2. **Автоматичне отримання через веб-інтерфейс** (fallback)
   - Якщо API автентифікація не працює (не встановлює JSESSIONID)
   - Використовується Playwright для автоматизації браузера
   - Відкривається веб-інтерфейс MediaSense
   - Виконується логін через веб-форму
   - Отримується JSESSIONID cookie
   - Cookie кешується на 25 хвилин

3. **Використання cookie**
   - JSESSIONID використовується для всіх подальших API запитів
   - Автоматично оновлюється при вичерпанні

---

## Компоненти

### MediaSenseCookieService

**Файл:** `apps/api/src/modules/media-sense/media-sense-cookie.service.ts`

**Функції:**
- `getJSessionId()` - отримує JSESSIONID (з кешу або через веб-інтерфейс)
- `fetchJSessionIdFromWeb()` - автоматизує логін через Playwright
- `clearCache()` - очищає кеш (для примусового оновлення)

**Особливості:**
- ✅ Кешування на 25 хвилин
- ✅ Автоматичне оновлення при вичерпанні
- ✅ Підтримка self-signed сертифікатів
- ✅ Обробка помилок та retry logic
- ✅ Детальне логування

### Інтеграція в MediaSenseClientService

**Файл:** `apps/api/src/modules/media-sense/media-sense-client.service.ts`

**Зміни:**
- Додано `loginViaWebInterface()` метод
- Автоматичний fallback до веб-інтерфейсу якщо API не працює
- Прозора інтеграція - не потребує змін в коді, що використовує клієнт

---

## Встановлення

### 1. Залежності

Playwright вже додано в `apps/api/package.json`:

```json
{
  "dependencies": {
    "playwright": "^1.48.0"
  }
}
```

### 2. Docker

Dockerfile оновлено для підтримки Playwright:

```dockerfile
# Встановлення Chromium та залежностей
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji

# Налаштування для використання системного Chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
```

### 3. Локальна розробка

Для локальної розробки Playwright автоматично завантажить браузери:

```bash
cd apps/api
npm install
npx playwright install chromium
```

---

## Використання

### Автоматичне (рекомендовано)

Код автоматично використовує веб-інтерфейс якщо API автентифікація не працює:

```typescript
// Нічого не потрібно змінювати в коді
const client = new MediaSenseClientService();
await client.configure({
  baseUrl: 'https://mediasense.example.com:8440',
  apiKey: 'username',
  apiSecret: 'password',
});

// Автоматично спробує API, потім веб-інтерфейс
await client.login();
```

### Ручне керування

Якщо потрібно примусово використати веб-інтерфейс:

```typescript
const cookieService = new MediaSenseCookieService();
const cookie = await cookieService.getJSessionId(
  'https://mediasense.example.com:8440',
  'username',
  'password',
);

// Використати cookie
client.configure({
  // ...
  manualJSessionId: cookie.jsessionId,
});
```

---

## Налаштування

### Environment Variables

```bash
# Шлях до Chromium (для Docker)
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Пропустити завантаження браузерів (використати системний)
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
```

### Конфігурація кешування

В `MediaSenseCookieService`:

```typescript
private readonly CACHE_DURATION_MS = 25 * 60 * 1000; // 25 хвилин
```

Cookie кешується на 25 хвилин (cookie MediaSense дійсний 30 хвилин).

---

## Логування

Сервіс логує всі операції:

```
[MediaSenseCookieService] Fetching JSESSIONID from web interface
[MediaSenseCookieService] Successfully obtained JSESSIONID from web interface
  - sessionIdMasked: 0683BFCE...5DD2
  - expiresAt: 2026-01-26T11:30:00.000Z
  - duration: 3456ms
```

---

## Troubleshooting

### Проблема: "Browser launch failed"

**Причина:** Chromium не встановлений або неправильний шлях

**Рішення:**
```bash
# Перевірити наявність Chromium
which chromium

# Встановити в Alpine Linux
apk add chromium

# Встановити шлях
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
```

### Проблема: "Login form fields not found"

**Причина:** Структура веб-інтерфейсу MediaSense відрізняється

**Рішення:**
- Перевірити селектори в `media-sense-cookie.service.ts`
- Можливо потрібно оновити селектори для вашої версії MediaSense

### Проблема: "JSESSIONID cookie not found after login"

**Причина:** Логін не вдався або cookie встановлюється пізніше

**Рішення:**
- Перевірити credentials
- Перевірити логи на наявність помилок
- Можливо потрібно збільшити затримку після логіну

### Проблема: Високе споживання ресурсів

**Причина:** Браузер залишається відкритим

**Рішення:**
- Браузер автоматично закривається при cleanup
- Кешування зменшує кількість запусків браузера
- Можна налаштувати більш тривале кешування

---

## Продуктивність

### Кешування

- Cookie кешується на **25 хвилин**
- Автоматичне оновлення при вичерпанні
- Один браузер використовується для всіх запитів

### Час отримання cookie

- Перший раз: ~3-5 секунд (запуск браузера + логін)
- З кешу: <1 мс
- Оновлення: ~3-5 секунд

---

## Безпека

### Credentials

- Credentials передаються тільки в веб-форму MediaSense
- Не зберігаються в логах
- Маскуються в логах

### Браузер

- Використовується headless режим (без GUI)
- Ізольований контекст для кожного запиту
- Автоматичне закриття після використання

---

## Обмеження

1. **Залежність від веб-інтерфейсу**
   - Якщо веб-інтерфейс зміниться, може знадобитися оновлення селекторів

2. **Ресурси**
   - Браузер потребує пам'ять та CPU
   - В Docker може знадобитися додаткова пам'ять

3. **Швидкість**
   - Перший запит може займати 3-5 секунд
   - Наступні запити швидкі завдяки кешуванню

---

## Альтернативи

### Варіант 1: Ручний JSESSIONID (тимчасово)

Див. `MEDIASENSE_MANUAL_JSESSIONID.md`

### Варіант 2: Вирішення проблеми з API

Якщо вдасться вирішити проблему з API автентифікацією, веб-інтерфейс автоматично не використовуватиметься.

---

## Наступні кроки

1. ✅ Реалізовано автоматичне отримання cookie
2. ⏳ Тестування в production
3. ⏳ Моніторинг продуктивності
4. ⏳ Оптимізація при потребі

---

**Дата створення:** 26 січня 2026  
**Останнє оновлення:** 26 січня 2026
