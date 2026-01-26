# Команди для виконання на віддаленому сервері

**Дата:** 26 січня 2026  
**Призначення:** Команди для deploy та діагностики MediaSense automation

---

## 🚀 Основна команда для deploy (рекомендовано)

```bash
cd /opt/qms && sudo git pull origin main && sudo chmod +x deploy-mediasense-automation.sh && sudo ./deploy-mediasense-automation.sh
```

**Що робить:**
1. Отримує останні зміни з git
2. Перевіряє конфігурацію MediaSense
3. Rebuild API контейнера (встановлює Playwright + Chromium)
4. Перезапускає API
5. Перевіряє встановлення Playwright
6. Запускає діагностику

**Час виконання:** ~5-10 хвилин (rebuild контейнера)

---

## 📋 Покрокові команди (якщо потрібно виконати окремо)

### Крок 1: Отримати останні зміни

```bash
cd /opt/qms && sudo git pull origin main
```

### Крок 2: Перевірити конфігурацію MediaSense

```bash
cd /opt/qms && sudo chmod +x check-mediasense-config.sh && sudo ./check-mediasense-config.sh
```

**Якщо не налаштовано:**
- Налаштуйте через веб-інтерфейс: `http://YOUR_SERVER_IP:5173` → Settings → Integrations → MediaSense

### Крок 3: Rebuild API контейнера

```bash
cd /opt/qms && sudo docker compose -f infra/docker-compose.yml build --no-cache api
```

**Час:** ~5-10 хвилин

### Крок 4: Перезапустити API

```bash
cd /opt/qms && sudo docker compose -f infra/docker-compose.yml up -d api
```

### Крок 5: Перевірити встановлення Playwright

```bash
sudo docker compose -f infra/docker-compose.yml exec api which chromium
sudo docker compose -f infra/docker-compose.yml exec api chromium --version
```

### Крок 6: Запустити діагностику

```bash
cd /opt/qms && sudo chmod +x diagnose-mediasense-detailed.sh && sudo ./diagnose-mediasense-detailed.sh
```

---

## 🔍 Команди для діагностики

### Перевірка конфігурації MediaSense

```bash
cd /opt/qms && sudo ./check-mediasense-config.sh
```

### Детальна діагностика

```bash
cd /opt/qms && sudo ./diagnose-mediasense-detailed.sh
```

### Збір всіх логів

```bash
cd /opt/qms && sudo chmod +x collect-mediasense-logs.sh && sudo ./collect-mediasense-logs.sh
```

### Перевірка логів Playwright/Cookie Service

```bash
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "cookie\|playwright\|browser\|chromium\|MediaSenseCookieService" | tail -50
```

### Перевірка статусу синхронізації

```bash
cd /opt/qms && sudo ./check-sync-status.sh
```

### Перевірка логів API (останні 100 рядків)

```bash
sudo docker compose -f infra/docker-compose.yml logs api | tail -100
```

### Перевірка логів MediaSense (останні 200 рядків)

```bash
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "mediasense" | tail -200
```

---

## ⚠️ Важливі зауваження

### Перед deploy:

1. **Переконайтеся, що MediaSense налаштовано в БД**
   - Якщо ні - налаштуйте через веб-інтерфейс
   - Скрипт `deploy-mediasense-automation.sh` перевірить це автоматично

2. **Rebuild може зайняти 5-10 хвилин**
   - Встановлення Playwright та Chromium
   - Компіляція TypeScript коду

3. **Після rebuild перевірте логи**
   - Переконайтеся, що API запустився
   - Перевірте, чи встановлений Chromium

### Після deploy:

1. **Перевірте логи CookieService**
   ```bash
   sudo docker compose -f infra/docker-compose.yml logs api | grep -i "cookie\|playwright" | tail -30
   ```

2. **Перевірте, чи працює синхронізація**
   ```bash
   sudo ./check-sync-status.sh
   ```

3. **Якщо синхронізація не працює:**
   - Перевірте логи на помилки
   - Перевірте, чи встановлений Chromium
   - Перевірте, чи CookieService інжектиться

---

## 🐛 Troubleshooting

### Проблема: "MediaSense не налаштовано в БД"

**Рішення:**
```bash
# Перевірте налаштування
sudo docker compose -f infra/docker-compose.yml exec -T postgres psql -U qms_user -d qms -c "SELECT * FROM \"IntegrationSetting\" WHERE \"integrationType\" = 'mediasense';"

# Налаштуйте через веб-інтерфейс або API
```

### Проблема: "Chromium не знайдено"

**Рішення:**
```bash
# Rebuild контейнера
cd /opt/qms && sudo docker compose -f infra/docker-compose.yml build --no-cache api && sudo docker compose -f infra/docker-compose.yml up -d api
```

### Проблема: "CookieService not available"

**Рішення:**
- Перевірте, чи додано MediaSenseCookieService в MediaSenseModule
- Перевірте логи при старті API
- Можливо потрібен rebuild

### Проблема: "Sync completed but fetched: 0"

**Можливі причини:**
- Автентифікація не працює (4021 помилка)
- Playwright automation не працює
- Немає нових записів в MediaSense

**Діагностика:**
```bash
# Перевірте логи синхронізації
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "mediasense.*sync\|4021\|invalid session" | tail -50

# Перевірте логи CookieService
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "cookie\|playwright" | tail -30
```

---

## 📊 Швидка перевірка після deploy

```bash
# 1. Перевірка Chromium
sudo docker compose -f infra/docker-compose.yml exec api which chromium

# 2. Перевірка логів CookieService
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "MediaSenseCookieService\|cookie.*service\|playwright" | tail -20

# 3. Перевірка статусу синхронізації
cd /opt/qms && sudo ./check-sync-status.sh

# 4. Перевірка логів автентифікації
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "mediasense.*login\|jsessionid\|cookie" | tail -30
```

---

## 📝 Приклад повного процесу

```bash
# 1. Deploy
cd /opt/qms && sudo git pull origin main && sudo chmod +x deploy-mediasense-automation.sh && sudo ./deploy-mediasense-automation.sh

# 2. Перевірка після deploy
sudo docker compose -f infra/docker-compose.yml logs api | grep -i "cookie\|playwright" | tail -30

# 3. Перевірка синхронізації
cd /opt/qms && sudo ./check-sync-status.sh

# 4. Якщо потрібно - збір логів
cd /opt/qms && sudo ./collect-mediasense-logs.sh
```

---

**Дата створення:** 26 січня 2026
