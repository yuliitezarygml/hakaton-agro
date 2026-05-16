import { useEffect, useRef, useState } from 'react';
import { SensorPayload } from '@/types/sensors';

export type AlertLevel = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  timestamp: number;
}

export function useAlerts(data: SensorPayload | null, connected: boolean) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const prevRain = useRef(false);
  const lastDataTime = useRef(Date.now());
  const [now, setNow] = useState(Date.now());

  // Обновляем время последних данных
  useEffect(() => {
    if (data) lastDataTime.current = Date.now();
  }, [data]);

  // Таймер для проверки "зависания" данных от ESP32
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const newAlerts: Alert[] = [];

    // ── Проверка: нет связи с Сервером ──
    if (!connected) {
      newAlerts.push({
        id: 'no-connection-server',
        level: 'critical',
        title: '⚠️ Нет связи с Сервером',
        message: 'Браузер не может подключиться к бэкенду.',
        timestamp: Date.now(),
      });
    }

    // ── Проверка: ESP32 не присылает данные > 15 секунд ──
    const timeSinceLastData = now - lastDataTime.current;
    if (connected && data && timeSinceLastData > 15000) {
      newAlerts.push({
        id: 'no-connection-esp',
        level: 'critical',
        title: '🔌 ESP32 не отвечает',
        message: `Нет данных от устройства уже ${Math.floor(timeSinceLastData / 1000)} сек. Проверьте питание ESP32.`,
        timestamp: Date.now(),
      });
    }

    if (data) {
      // ── Проверка: зоны не отвечают ──
      data.zones.forEach(z => {
        if (z.online === false || z.temp === -99) {
          newAlerts.push({
            id: `zone-offline-${z.zone}`,
            level: 'critical',
            title: `🔴 Зона ${z.zone} не отвечает`,
            message: `Датчик DHT11 зоны ${z.zone} не выходит на связь. Проверьте проводку.`,
            timestamp: Date.now(),
          });
        }
      });

      // ── Проверка: дождь (только info) ──
      if (data.rain && !prevRain.current) {
        newAlerts.push({
          id: 'rain-started',
          level: 'info',
          title: '🌧️ Начался дождь',
          message: 'Датчик дождя зафиксировал осадки.',
          timestamp: Date.now(),
        });
      }
      prevRain.current = data.rain;
    }

    const active = newAlerts.filter(a => !dismissed.has(a.id));
    setAlerts(active);
  }, [data, connected, dismissed, now]);

  const dismissAlert = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  return { alerts, dismissAlert };
}
