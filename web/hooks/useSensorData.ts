'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { SensorPayload, SensorHistory } from '@/types/sensors';

const WS_URL  = 'ws://localhost:8080/ws';
const API_URL = 'http://localhost:8080/api/sensors';
const HISTORY_URL = 'http://localhost:8080/api/history';

export function useSensorData() {
  const [data, setData]           = useState<SensorPayload | null>(null);
  const [history, setHistory]     = useState<SensorHistory>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Загрузка истории
  const fetchHistory = useCallback(() => {
    fetch(HISTORY_URL)
      .then(r => r.json())
      .then((h: SensorHistory) => setHistory(h))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Начальная загрузка
    fetch(API_URL)
      .then(r => r.json())
      .then((d: SensorPayload) => setData(d))
      .catch(() => {});

    fetchHistory();

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen    = () => setConnected(true);
      ws.onclose   = () => { setConnected(false); setTimeout(connect, 3000); };
      ws.onerror   = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const payload: SensorPayload = JSON.parse(e.data);
          setData(payload);
          // Добавляем в локальную историю
          setHistory(prev => {
            const next = [...prev, payload];
            // Храним макс. 360 записей на клиенте тоже
            return next.length > 360 ? next.slice(-360) : next;
          });
        } catch {}
      };
    };
    connect();
    return () => { wsRef.current?.close(); };
  }, [fetchHistory]);

  return { data, history, connected };
}
