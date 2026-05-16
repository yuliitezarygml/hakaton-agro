import { useEffect, useRef, useState, useCallback } from 'react';
import { SensorPayload, SensorHistory } from '../types/sensors';

// ── Поменяй на IP своего Go-сервера ──────────────────────────────
const SERVER_IP = '192.168.4.99'; // ← твой IP
const WS_URL    = `ws://${SERVER_IP}:8080/ws`;
const API_URL   = `http://${SERVER_IP}:8080/api/sensors`;
const HIST_URL  = `http://${SERVER_IP}:8080/api/history`;

export function useSensorData() {
  const [data, setData]         = useState<SensorPayload | null>(null);
  const [history, setHistory]   = useState<SensorHistory>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchHistory = useCallback(() => {
    fetch(HIST_URL)
      .then(r => r.json())
      .then((h: SensorHistory) => Array.isArray(h) && setHistory(h))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(API_URL)
      .then(r => r.json())
      .then((d: SensorPayload) => setData(d))
      .catch(() => {});

    fetchHistory();

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen  = () => setConnected(true);
      ws.onclose = () => { setConnected(false); setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const payload: SensorPayload = JSON.parse(e.data);
          setData(payload);
          setHistory(prev => {
            const next = [...prev, payload];
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
