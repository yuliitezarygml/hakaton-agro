# AgriMap Mobile — React Native (Expo)

## Запуск

### 1. Установи Expo Go на телефон
- Android: https://play.google.com/store/apps/details?id=host.exp.exponent

### 2. Поменяй IP сервера
В файле `src/hooks/useSensorData.ts` строка 6:
```ts
const SERVER_IP = '192.168.4.99'; // ← поменяй на IP своего Go-сервера
```

### 3. Запусти
```bash
cd mobile
npm start
```
Отсканируй QR-код в Expo Go — приложение запустится.

---

## Структура

```
mobile/
├── App.tsx                        # Навигация (2 таба)
├── src/
│   ├── types/sensors.ts           # Типы (идентично веб)
│   ├── hooks/useSensorData.ts     # WebSocket + REST (идентично веб)
│   ├── screens/
│   │   ├── DashboardScreen.tsx    # Карточки зон + графики
│   │   └── MapScreen.tsx          # Спутниковая карта + сектора
│   └── components/
│       └── SensorCharts.tsx       # SVG спарклайны
```

## Функционал

| Экран | Что делает |
|-------|-----------|
| 📊 Показания | Зоны DHT11, влажность почвы, дождь, графики |
| 🗺️ Карта | Спутник, 4 сектора 200м, повёрнуты 30°, метки температуры |

## Сборка APK (без Android Studio)

```bash
npm install -g eas-cli
eas build -p android --profile preview
```
> Нужен бесплатный аккаунт на https://expo.dev
