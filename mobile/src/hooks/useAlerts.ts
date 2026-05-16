import { useEffect, useRef, useState } from 'react';
import { SensorPayload } from '../types/sensors';
import { Vibration, Platform } from 'react-native';

export type AlertLevel = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  timestamp: number;
}

/**
 * Хук для отслеживания аварийных ситуаций:
 * - Зона не отвечает (online=false) → critical
 * - Нет данных от ESP32 > 15 сек → critical  
 * - Идёт дождь → info
 */
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

  // Таймер для проверки "зависания" данных от ESP32 (отвалился ESP, а не сокет)
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
        message: 'Приложение не может подключиться к бэкенду.',
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

      // ── Проверка: дождь (только info, без тревоги) ──
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

    // Фильтруем уже закрытые
    const active = newAlerts.filter(a => !dismissed.has(a.id));
    setAlerts(active);

    // Вибрация при критических алертах
    const hasCritical = active.some(a => a.level === 'critical');
    if (hasCritical && Platform.OS !== 'web') {
      Vibration.vibrate([0, 500, 200, 500]);
    }
  }, [data, connected, dismissed, now]);

  const dismissAlert = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  const clearDismissed = () => setDismissed(new Set());

  return { alerts, dismissAlert, clearDismissed };
}
