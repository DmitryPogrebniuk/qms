# QMS Моніторинг та траблшутінг

## 1. qms-agent.sh — консольний агент

Локальний скрипт для швидкої діагностики на сервері.

```bash
cd /opt/qms
sudo ./qms-agent.sh [status|logs|collect|full]
```

| Команда | Опис |
|---------|------|
| `status` | Контейнери, API health, sync status, кількість записів |
| `logs` | Останні 50 рядків логів api, nginx, web, postgres |
| `collect` | Зберегти повний звіт у `/tmp/qms-report-*.tar.gz` |
| `full` | status + logs (за замовчуванням) |

**Приклад збору звіту для підтримки:**
```bash
sudo ./qms-agent.sh collect
scp boss@192.168.200.199:/tmp/qms-report-*.tar.gz .
```

---

## 2. Опційний стек Prometheus + Grafana

Для графіків CPU/RAM, історії метрик.

```bash
cd /opt/qms
sudo docker compose -f infra/docker-compose.yml -f infra/docker-compose.monitoring.yml up -d
```

| Сервіс | URL | Опис |
|--------|-----|------|
| Grafana | https://192.168.200.199:3001 | Дашборди (admin/admin) |
| Prometheus | https://192.168.200.199:9090 | Метрики |
| cAdvisor | https://192.168.200.199:8081 | Метрики Docker-контейнерів |

**Grafana — перший вхід:**
1. Логін: admin / admin
2. Змінити пароль
3. Add data source → Prometheus → URL: `http://prometheus:9090`
4. Import dashboard: 193 (Docker) або 14282 (cAdvisor)

---

## 3. Існуючі скрипти

| Скрипт | Призначення |
|--------|-------------|
| `infra/check-services.sh` | Швидка перевірка сервісів |
| `check-sync-status.sh` | Статус MediaSense sync з БД |
| `clear-all-logs.sh` | Очищення логів MediaSense |

---

## 4. Логи Docker

```bash
# Останні логи API
sudo docker compose -f infra/docker-compose.yml logs -f --tail 100 api

# Всі сервіси
sudo docker compose -f infra/docker-compose.yml logs -f
```
