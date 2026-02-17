# Cisco QMS — Технічний опис для AI

Документ описує функціонал, архітектуру та взаємодії системи Cisco Quality Management System (QMS) для інтеграції з іншими AI-асистентами.

---

## 1. Загальний огляд

**QMS** — система управління якістю для контакт-центрів, інтегрована з:
- **Cisco UCCX 15** — джерело даних про агентів, команди, черги
- **Cisco MediaSense 11.5** — метадані та аудіо записів
- **Keycloak** — аутентифікація (OIDC)

**Стек:** NestJS (API), React + Vite + MUI (Web), PostgreSQL, OpenSearch, Redis, Docker.

---

## 2. Структура проекту

```
qms-1/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── common/         # Guards, decorators, Prisma
│   │   │   ├── modules/         # Feature modules
│   │   │   │   ├── auth/       # JWT, Keycloak, local login
│   │   │   │   ├── recordings/ # Пошук, стримінг, теги, нотатки
│   │   │   │   ├── media-sense/# Синхронізація з MediaSense
│   │   │   │   ├── opensearch/ # Індексація та пошук
│   │   │   │   ├── uccx/       # Синхронізація з UCCX
│   │   │   │   ├── evaluations/
│   │   │   │   ├── coaching/
│   │   │   │   ├── users/
│   │   │   │   └── ...
│   │   │   └── main.ts
│   │   └── prisma/
│   │       └── schema.prisma
│   └── web/                    # React SPA
│       └── src/
│           ├── pages/           # Search, Dashboard, Evaluations, etc.
│           ├── components/     # RecordingsSearchFilters, RecordingDetailsDrawer
│           ├── services/       # recordingsApi.ts, useHttpClient
│           ├── hooks/
│           └── locales/        # en.json, uk.json
├── packages/shared/
└── infra/                      # Docker, Nginx
```

---

## 3. Аутентифікація та RBAC

### 3.1 Ролі

| Роль       | Доступ до записів      | Фільтри (agents/teams) | Інше                    |
|------------|------------------------|------------------------|-------------------------|
| **ADMIN**  | Усі                     | Усі опції              | Управління користувачами |
| **QA**     | Усі                     | Усі опції              | Оцінювання, коучинг     |
| **SUPERVISOR** | Тільки свої команди | teamCodes з User       | Оцінювання своїх команд |
| **USER**   | Тільки свої             | agentId = свій         | Переглядає свої записи  |

### 3.2 Потік аутентифікації

1. **Keycloak:** користувач логіниться → OIDC token
2. **POST /api/auth/verify-token:** API перевіряє токен, синхронізує User у БД, створює Session, повертає внутрішній JWT
3. **Локальний логін:** POST /api/auth/login з username/password → JWT
4. **JWT Strategy:** при кожному запиті завантажує User з БД і додає `agentId`, `teamCodes` до `req.user`

### 3.3 Важливі поля req.user

```typescript
req.user = {
  sub: string;           // User.id (наш внутрішній ID)
  preferred_username: string;
  role: string;          // ADMIN | QA | SUPERVISOR | USER
  roles: string[];
  agentId?: string;      // UCCX agentId (для USER) — з User.agentId
  teamCodes: string[];   // Коди команд (для SUPERVISOR) — з User.teamCodes
}
```

**Важливо:** `agentId` і `teamCodes` беруться з таблиці User при кожному запиті (JwtStrategy). Для Keycloak-користувачів вони заповнюються при першому логіні (зв’язок username ↔ Agent.agentId) і оновлюються при кожному verify-token.

---

## 4. Записи (Recordings)

### 4.1 Джерело даних

- **MediaSense** — метадані (ANI, DNIS, agent, team, direction, duration тощо) та посилання на аудіо
- **Recording** у БД — копія метаданих + зв’язки з Agent, Team
- **RecordingTag** — теги (user, mediasense, auto)
- **RecordingNote** — нотатки користувача

### 4.2 Пошук записів

**Ендпоінт:** `GET /api/recordings/search`

**Параметри (query):**
- `q` — full-text пошук
- `dateFrom`, `dateTo` — діапазон дат
- `durationFrom`, `durationTo` — тривалість (секунди)
- `direction` — inbound | outbound | internal
- `agentIds`, `teamCodes`, `queueIds` — кома-розділені ID
- `tags` — кома-розділені назви тегів
- `ani`, `dnis`, `callId`, `sessionId`
- `hasAudio`, `wrapUpReasons`
- `sort`, `order`, `page`, `pageSize`

**Логіка вибору пошуку:**
- Якщо `OPENSEARCH_HOST` задано → спочатку OpenSearch, fallback на Postgres
- Якщо є фільтр `tags` → завжди Postgres (RecordingTag)
- Інакше — OpenSearch або Postgres

**RBAC у пошуку:**
- ADMIN/QA: без додаткових обмежень
- SUPERVISOR: `teamCodes` обмежуються `req.user.teamCodes`
- USER: `agentIds = [req.user.agentId]` або `['__none__']` якщо agentId відсутній

### 4.3 Фільтри (filter-options)

**Ендпоінт:** `GET /api/recordings/filter-options/:field`  
**field:** `agents` | `teams` | `queues` | `wrapUpReasons` | `tags`

Опції формуються з Recording (agents, teams, queues, wrapUpReasons) або RecordingTag (tags) з урахуванням RBAC:
- ADMIN/QA: всі значення
- SUPERVISOR: тільки `teamCode IN teamCodes`
- USER: тільки `agentId = agentId` або порожній список, якщо agentId немає

### 4.4 Теги та нотатки

**RecordingTag (Prisma):**
- `tagName`, `tagValue`, `tagSource` (user | mediasense | auto)
- Унікальність: `(recordingId, tagName)`

**RecordingNote (Prisma):**
- `noteText`, `timestamp` (секунди в записі), `createdBy`

**API:**
- `POST /api/recordings/:id/tags` — body: `{ tagName, tagValue? }`
- `POST /api/recordings/:id/notes` — body: `{ noteText, timestamp? }`

**Відображення:**
- У деталях запису: `tag.tagName`, `note.noteText`
- У результатах пошуку: `tags` — `string[]` (назви тегів)

**OpenSearch і теги:**
- При `addTag` запис переіндексується з актуальними тегами з RecordingTag
- При пошуку без фільтра тегів результати з OpenSearch доповнюються тегами з RecordingTag
- При фільтрі по тегах використовується тільки Postgres

---

## 5. OpenSearch

### 5.1 Індекси

- Шаблон: `{prefix}-recordings-*`
- Індекси по місяцях: `recordings-2024.01`, `recordings-2024.02` тощо

### 5.2 Поля індексу

- `id`, `mediasenseSessionId`, `agentId`, `agentName`, `teamCode`, `teamName`
- `startTime`, `endTime`, `durationSeconds`, `direction`
- `ani`, `dnis`, `callId`, `csq`, `queueName`, `wrapUpReason`
- `hasAudio`, `tags` (масив рядків), `searchText`

### 5.3 Індексація

- **MediaSense sync:** після створення/оновлення Recording викликається `indexToOpenSearch` (теги з session + RecordingTag)
- **addTag:** після додавання тега викликається `reindexRecordingForTags` з актуальними тегами з RecordingTag

---

## 6. MediaSense синхронізація

- Інкрементальна синхронізація метаданих
- Зв’язок Recording ↔ Agent через `extension` або `agentId` з MediaSense
- Теги MediaSense зберігаються в RecordingTag з `tagSource: 'mediasense'`
- Аудіо не зберігається локально — стримінг через проксі до MediaSense

---

## 7. UCCX синхронізація

- Синхронізація: Team, Agent, ContactServiceQueue (CSQ)
- Agent.agentId = UCCX userId (AD login)
- AgentTeam — зв’язок агент ↔ команда
- User.agentId і User.teamCodes заповнюються при Keycloak sync (username → Agent.agentId → teamCodes)

---

## 8. Ключові API ендпоінти

| Метод | Шлях | Опис |
|-------|------|------|
| POST | /api/auth/login | Локальний логін |
| POST | /api/auth/verify-token | Обмін Keycloak token на JWT |
| GET | /api/users/profile | Профіль поточного користувача |
| GET | /api/recordings/search | Пошук записів |
| GET | /api/recordings/filter-options/:field | Опції для фільтрів |
| GET | /api/recordings/:id | Деталі запису |
| GET | /api/recordings/:id/stream | Стримінг аудіо (Range) |
| POST | /api/recordings/:id/tags | Додати тег |
| POST | /api/recordings/:id/notes | Додати нотатку |
| POST | /api/recordings/:id/export | Експорт у MP3/WAV |
| GET | /api/users/agents | Список агентів |
| GET | /api/users/teams | Команди (з урахуванням RBAC) |

---

## 9. Frontend

### 9.1 Маршрути

- `/login` — логін
- `/` — Dashboard
- `/search` — пошук записів
- `/recordings/:id` — сторінка запису
- `/evaluations`, `/coaching`
- `/admin/settings`, `/admin/maintenance`, `/admin/audit`
- `/about`

### 9.2 Ключові компоненти

- **RecordingsSearchFilters** — панель фільтрів (дати, агенти, команди, черги, теги)
- **RecordingsResultsTable** — таблиця результатів (колонка tags підтримує `string[]` і `RecordingTag[]`)
- **RecordingDetailsDrawer** — деталі запису, аудіоплеєр, теги, нотатки

### 9.3 Типи (recordingsApi.ts)

- `RecordingSearchParams` — параметри пошуку (agents, teams, queues, tags — масиви)
- `Recording` — повний запис (tags?: (RecordingTag | string)[])
- `RecordingTag` — `tagName`, `tagValue`, `name?`, `color?`
- `RecordingNote` — `noteText`, `text?`, `timestamp?`

---

## 10. База даних (ключові сутності)

- **User** — keycloakId, username, role, agentId, teamCodes
- **Agent** — agentId (UCCX), fullName, extension
- **Team** — teamCode, displayName
- **Recording** — mediasenseSessionId, agentId, teamCode, startTime, durationSeconds, hasAudio, searchVector
- **RecordingTag** — recordingId, tagName, tagValue, tagSource
- **RecordingNote** — recordingId, noteText, timestamp, createdBy
- **Evaluation**, **CoachingPlan**, **Dispute** — оцінювання та коучинг

---

## 11. Типові сценарії для AI

### Пошук з фільтрами
1. Користувач відкриває `/search`
2. `loadFilterOptions` → GET filter-options для agents, teams, queues, tags
3. Користувач обирає фільтри → `handleFiltersChange` → `searchRecordings(params)`
4. API застосовує RBAC до params і викликає search (OpenSearch або Postgres)
5. Результати відображаються в RecordingsResultsTable

### Додавання тега
1. Користувач відкриває деталі запису → RecordingDetailsDrawer
2. Вводить тег і натискає «Додати»
3. POST /api/recordings/:id/tags з `{ tagName, tagValue? }`
4. RecordingsService: upsert RecordingTag, асинхронно reindexRecordingForTags
5. onRefresh → getRecording → оновлення даних у drawer

### Відображення тегів у таблиці
- Postgres: `tags` приходять як `string[]` з `tags.map(t => t.tagName)`
- OpenSearch: `tags` з _source + enrichItemsWithTags з RecordingTag
- Компонент підтримує обидва формати: `typeof tag === 'string' ? tag : tag.tagName`

---

## 12. Конфігурація (env)

- `DATABASE_URL` — PostgreSQL
- `JWT_SECRET` — підпис JWT
- `KEYCLOAK_ISSUER`, `KEYCLOAK_REALM` — Keycloak
- `OPENSEARCH_HOST` — якщо задано, використовується OpenSearch для пошуку
- `MEDIASENSE_HOST`, `UCCX_HOST` — інтеграції

---

*Версія: 1.0 | Оновлено: січень 2026*
