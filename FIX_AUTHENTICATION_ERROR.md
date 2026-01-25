# Виправлення помилки: Authentication failed - credentials not valid

## Проблема

```
Error: P1000: Authentication failed against database server, 
the provided database credentials for `qms` are not valid.
```

**Причина:** Credentials `qms:qms` не відповідають налаштуванням PostgreSQL в Docker контейнері.

## Рішення

### Крок 1: Перевірте реальні credentials в Docker

```bash
# Перевірити environment variables в контейнері PostgreSQL
docker-compose exec postgres env | grep POSTGRES
```

Ви побачите щось на кшталт:
```
POSTGRES_USER=qms_user
POSTGRES_PASSWORD=qms_password_secure
POSTGRES_DB=qms
```

### Крок 2: Використайте правильні credentials

**Варіант A: Якщо в Docker використовується `qms_user`:**

```bash
cd /opt/qms/apps/api
export DATABASE_URL="postgresql://qms_user:qms_password_secure@localhost:5432/qms"
npm run db:migrate:deploy
```

**Варіант B: Якщо потрібно створити користувача `qms`:**

```bash
# Підключитися до PostgreSQL як superuser
docker-compose exec postgres psql -U postgres

# Створити користувача та базу даних
CREATE USER qms WITH PASSWORD 'qms';
CREATE DATABASE qms OWNER qms;
GRANT ALL PRIVILEGES ON DATABASE qms TO qms;
\q

# Тепер використати нові credentials
cd /opt/qms/apps/api
export DATABASE_URL="postgresql://qms:qms@localhost:5432/qms"
npm run db:migrate:deploy
```

**Варіант C: Змінити credentials в docker-compose.yml**

Якщо хочете використовувати `qms:qms`, оновіть docker-compose.yml:

```yaml
postgres:
  environment:
    POSTGRES_USER: qms
    POSTGRES_PASSWORD: qms
    POSTGRES_DB: qms
```

Потім перезапустіть контейнер:
```bash
docker-compose down postgres
docker-compose up -d postgres
# Зачекайте поки контейнер запуститься
sleep 5
cd /opt/qms/apps/api
export DATABASE_URL="postgresql://qms:qms@localhost:5432/qms"
npm run db:migrate:deploy
```

## Швидка діагностика

### 1. Перевірте, які користувачі існують в PostgreSQL:

```bash
docker-compose exec postgres psql -U postgres -c "\du"
```

### 2. Перевірте підключення з різними credentials:

```bash
# Спробувати з qms_user
docker-compose exec postgres psql -U qms_user -d qms -c "SELECT current_user;"

# Спробувати з qms
docker-compose exec postgres psql -U qms -d qms -c "SELECT current_user;"

# Спробувати з postgres (superuser)
docker-compose exec postgres psql -U postgres -c "SELECT current_user;"
```

### 3. Перевірте, яка база даних існує:

```bash
docker-compose exec postgres psql -U postgres -c "\l"
```

## Найпростіше рішення

Якщо не впевнені в credentials, використайте superuser для міграції:

```bash
cd /opt/qms/apps/api

# PostgreSQL за замовчуванням має superuser 'postgres' без пароля в Docker
export DATABASE_URL="postgresql://postgres@localhost:5432/qms"
npm run db:migrate:deploy
```

Або якщо потрібен пароль:

```bash
# Перевірити пароль postgres (зазвичай встановлюється через POSTGRES_PASSWORD)
docker-compose exec postgres env | grep POSTGRES_PASSWORD

# Використати знайдений пароль
export DATABASE_URL="postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/qms"
npm run db:migrate:deploy
```

## Створення правильного користувача

Якщо хочете створити користувача `qms` з паролем `qms`:

```bash
# Підключитися як postgres
docker-compose exec postgres psql -U postgres << EOF
-- Створити користувача (якщо не існує)
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'qms') THEN
    CREATE USER qms WITH PASSWORD 'qms';
  END IF;
END
\$\$;

-- Створити базу даних (якщо не існує)
SELECT 'CREATE DATABASE qms OWNER qms'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'qms')\gexec

-- Надати права
GRANT ALL PRIVILEGES ON DATABASE qms TO qms;
\c qms
GRANT ALL ON SCHEMA public TO qms;
EOF

# Тепер використати нові credentials
cd /opt/qms/apps/api
export DATABASE_URL="postgresql://qms:qms@localhost:5432/qms"
npm run db:migrate:deploy
```

## Перевірка після виправлення

```bash
# Тест підключення
psql -U qms -d qms -h localhost -c "SELECT current_user, current_database();"

# Або через Docker
docker-compose exec postgres psql -U qms -d qms -c "SELECT current_user, current_database();"
```

Якщо команда виконується успішно, credentials правильні!
