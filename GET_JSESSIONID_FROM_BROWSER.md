# Як отримати JSESSIONID з браузера - Покрокова інструкція

## Швидкий спосіб (Chrome/Edge)

### Крок 1: Відкрийте Application tab
1. У вас вже відкритий DevTools (F12)
2. Перейдіть на вкладку **Application** (або **Storage** в Firefox)

### Крок 2: Знайдіть Cookies
1. У лівій панелі розгорніть **Cookies**
2. Клікніть на `https://mediasense2.tas.local:8440` (або ваш URL MediaSense)
3. У правій панелі знайдіть рядок з **Name** = `JSESSIONID`
4. Скопіюйте значення з колонки **Value**

**Приклад:**
```
Name: JSESSIONID
Value: 0683BFCE250C6380CF68D66DF21E5DD2  ← Скопіюйте це
```

## Альтернативний спосіб (Network tab)

### Крок 1: Відкрийте Network tab
1. Перейдіть на вкладку **Network** (Сеть)
2. Оновіть сторінку (F5) або виконайте будь-яку дію на сторінці

### Крок 2: Знайдіть запит
1. Знайдіть будь-який запит до MediaSense (наприклад, до `/ora/queryService/query/getSessions`)
2. Клікніть на запит
3. Відкрийте вкладку **Headers**

### Крок 3: Скопіюйте JSESSIONID
1. Прокрутіть до **Request Headers**
2. Знайдіть рядок `Cookie:`
3. Знайдіть `JSESSIONID=...`
4. Скопіюйте значення після `JSESSIONID=`

**Приклад:**
```
Cookie: JSESSIONID=0683BFCE250C6380CF68D66DF21E5DD2; other=cookies...
                                    ↑ Скопіюйте це
```

## Спосіб через Console

1. Відкрийте вкладку **Console** (Консоль)
2. Введіть команду:
```javascript
document.cookie.split(';').find(c => c.trim().startsWith('JSESSIONID'))
```
3. Натисніть Enter
4. Скопіюйте значення після `JSESSIONID=`

## Тестування з JSESSIONID

Після отримання JSESSIONID:

```bash
cd /opt/qms
sudo git pull origin main
sudo chmod +x test-mediasense-with-jsessionid.sh
sudo ./test-mediasense-with-jsessionid.sh 0683BFCE250C6380CF68D66DF21E5DD2
```

(Замініть `0683BFCE250C6380CF68D66DF21E5DD2` на ваш JSESSIONID)

## Важливо

- JSESSIONID має термін дії (зазвичай 30 хвилин)
- Якщо він застарілий, оновіть сторінку та отримайте новий
- JSESSIONID може бути довгим (32+ символи)

## Якщо JSESSIONID не знайдено

1. Переконайтеся, що ви авторизовані в веб-інтерфейсі
2. Перевірте, чи ви на правильному домені (`mediasense2.tas.local:8440`)
3. Спробуйте оновити сторінку (F5)
4. Перевірте, чи немає помилок автентифікації в консолі
