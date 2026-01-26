# MediaSense - Використання ручного JSESSIONID для тестування

**Дата:** 26 січня 2026  
**Призначення:** Тимчасове рішення для тестування поки вирішується проблема з автентифікацією через API

---

## Швидкий старт

### Крок 1: Отримати JSESSIONID з веб-інтерфейсу MediaSense

1. Відкрийте MediaSense веб-інтерфейс в браузері:
   ```
   https://192.168.200.133:8440
   ```

2. Увійдіть з вашими credentials

3. Відкрийте DevTools (F12)

4. Перейдіть до вкладки **Application** (або **Storage**)

5. В лівому меню виберіть **Cookies** → `https://192.168.200.133:8440`

6. Знайдіть cookie з назвою `JSESSIONID`

7. Скопіюйте **значення** (Value) цього cookie

   Приклад: `0683BFCE250C6380CF68D66DF21E5DD2`

---

## Крок 2: Встановити JSESSIONID

### Варіант A: Через Environment Variable (рекомендовано для тестування)

Додайте в `.env` файл або в environment variables:

```bash
MEDIASENSE_JSESSIONID=0683BFCE250C6380CF68D66DF21E5DD2
```

**Для Docker:**
```bash
# В infra/docker-compose.yml додайте в секцію api:
environment:
  - MEDIASENSE_JSESSIONID=${MEDIASENSE_JSESSIONID}
```

Потім в `.env` файлі на сервері:
```bash
MEDIASENSE_JSESSIONID=0683BFCE250C6380CF68D66DF21E5DD2
```

### Варіант B: Через конфігурацію в БД

Оновіть налаштування інтеграції в БД:

```sql
UPDATE "IntegrationSetting"
SET settings = jsonb_set(
  settings,
  '{manualJSessionId}',
  '"0683BFCE250C6380CF68D66DF21E5DD2"'
)
WHERE "integrationType" = 'mediasense';
```

---

## Крок 3: Перезапустити API

```bash
sudo docker compose -f infra/docker-compose.yml restart api
```

---

## Крок 4: Перевірити

### 1. Перевірити логи

```bash
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "mediasense\|jsessionid" | tail -20
```

Ви повинні побачити:
```
[MediaSense] [WARN] Using manually provided JSESSIONID (temporary workaround)
```

### 2. Запустити синхронізацію

```bash
# Через API endpoint (потрібен JWT token)
curl -X POST http://localhost:3000/api/recordings/admin/sync-now \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Або через веб-інтерфейс в розділі адміністрації.

### 3. Перевірити статус

```bash
sudo ./check-sync-status.sh
```

---

## Важливі зауваження

### ⚠️ Тимчасове рішення

Це **тимчасове рішення** для тестування. JSESSIONID cookie має обмежений термін дії (зазвичай 30 хвилин - 1 година).

### ⚠️ Оновлення cookie

Коли cookie вичерпається:
1. Отримайте новий JSESSIONID з веб-інтерфейсу
2. Оновіть environment variable або налаштування в БД
3. Перезапустіть API

### ⚠️ Безпека

- Не зберігайте JSESSIONID в git
- Використовуйте environment variables або секретні менеджери
- Не логуйте повний JSESSIONID (код автоматично маскує його в логах)

---

## Автоматизація (майбутнє)

Планується реалізувати автоматичне отримання JSESSIONID через веб-інтерфейс за допомогою Puppeteer/Playwright. Див. `MEDIASENSE_NEXT_STEPS.md` для деталей.

---

## Troubleshooting

### Проблема: "Invalid session (4021)"

**Причина:** JSESSIONID вичерпався або невірний

**Рішення:**
1. Отримайте новий JSESSIONID з веб-інтерфейсу
2. Оновіть налаштування
3. Перезапустіть API

### Проблема: JSESSIONID не використовується

**Перевірте:**
1. Чи правильно встановлено environment variable?
2. Чи перезапущений API після зміни?
3. Чи є попередження в логах про використання ручного JSESSIONID?

### Проблема: Синхронізація не отримує дані

**Можливі причини:**
1. JSESSIONID невірний або вичерпався
2. Проблеми з мережею до MediaSense
3. Проблеми з форматом запиту (перевірте логи)

**Діагностика:**
```bash
# Перевірити автентифікацію
sudo ./diagnose-mediasense-auth.sh

# Перевірити логи синхронізації
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "mediasense" | tail -50
```

---

## Приклад використання

### 1. Отримати JSESSIONID

```bash
# Відкрити MediaSense в браузері
# DevTools → Application → Cookies
# Скопіювати значення JSESSIONID
```

### 2. Встановити в .env

```bash
echo "MEDIASENSE_JSESSIONID=0683BFCE250C6380CF68D66DF21E5DD2" >> .env
```

### 3. Перезапустити

```bash
sudo docker compose -f infra/docker-compose.yml restart api
```

### 4. Перевірити

```bash
# Перевірити логи
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "jsessionid"

# Запустити синхронізацію
curl -X POST http://localhost:3000/api/recordings/admin/sync-now \
  -H "Authorization: Bearer $JWT_TOKEN"

# Перевірити статус
sudo ./check-sync-status.sh
```

---

**Дата створення:** 26 січня 2026  
**Останнє оновлення:** 26 січня 2026
