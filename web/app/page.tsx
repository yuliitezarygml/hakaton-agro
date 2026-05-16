'use client';

import dynamic from 'next/dynamic';
import { useSensorData } from '@/hooks/useSensorData';
import { useAlerts } from '@/hooks/useAlerts';
import AlertOverlay from '@/components/AlertOverlay';

const GardenMap = dynamic(() => import('@/components/GardenMap'), { ssr: false });
const SensorCharts = dynamic(() => import('@/components/SensorCharts'), { ssr: false });

function tempClass(t: number): string {
  if (t <= 0)  return 'freeze';
  if (t <= 10) return 'cold';
  if (t <= 20) return 'cool';
  if (t <= 28) return 'warm';
  return 'hot';
}

function soilColor(s: number): string {
  if (s < 30) return '#ff6633';
  if (s < 60) return '#ffcc44';
  return '#44cc88';
}

export default function HomePage() {
  const { data, history, connected } = useSensorData();
  const { alerts, dismissAlert } = useAlerts(data, connected);

  const formatTime = (iso: string) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleTimeString('ru-RU'); } catch { return '—'; }
  };

  const zones = data?.zones ?? [
    { zone: 1, temp: 22.5, humidity: 65, online: true },
    { zone: 2, temp: 21.0, humidity: 70, online: true },
    { zone: 3, temp: -1.5, humidity: 85, online: true },
    { zone: 4, temp: 24.0, humidity: 60, online: true },
  ];

  return (
    <div className="app-shell">
      <AlertOverlay alerts={alerts} onDismiss={dismissAlert} />
      <header className="header">
        <span className="header-logo">🌿</span>
        <div>
          <div className="header-title">AgriMap</div>
          <div className="header-sub">Мониторинг садового участка</div>
        </div>
        <span className={`status-dot${connected ? ' live' : ''}`} />
        <span className="status-label">{connected ? 'Live' : 'Offline'}</span>
      </header>

      <main className="canvas-wrap">
        <div className="stars" />
        <GardenMap payload={data} />
      </main>

      <aside className="sidebar">
        <div className="sidebar-title">Зоны (DHT11)</div>

        {zones.map(z => {
          const temp = typeof z.temp === 'number' && !isNaN(z.temp) ? z.temp : 0;
          const humidity = typeof z.humidity === 'number' && !isNaN(z.humidity) ? z.humidity : 0;
          const cls = tempClass(temp);
          const isFreezing = temp < 0;
          return (
            <div key={z.zone} className={`zone-card${isFreezing ? ' freeze' : ''}`}>
              {isFreezing && <div className="freeze-shimmer" />}
              <div className="zone-card-header">
                <span className="zone-name">Зона {z.zone}</span>
                <span className={`zone-badge ${isFreezing ? 'freeze' : 'normal'}`}>
                  {isFreezing ? '❄️ Мороз' : '✅ Норма'}
                </span>
              </div>
              <div className={`zone-temp ${cls}`}>
                {temp > 0 ? `+${temp.toFixed(1)}` : temp.toFixed(1)}°C
              </div>
              <div className="zone-hum">💧 {humidity.toFixed(0)}%</div>
            </div>
          );
        })}

        <div className="sidebar-title" style={{ marginTop: 8 }}>Центр</div>

        <div className="center-card">
          <div className="center-row">
            <span className="center-icon">🌱</span>
            <div>
              <div className="center-label">Влажность почвы</div>
              <div className="center-value" style={{ color: soilColor(data?.soil_moisture ?? 48) }}>
                {data?.soil_moisture ?? 48}%
              </div>
            </div>
          </div>
          <div className="soil-bar-track">
            <div className="soil-bar-fill" style={{
              width: `${data?.soil_moisture ?? 48}%`,
              background: soilColor(data?.soil_moisture ?? 48),
            }} />
          </div>
        </div>

        <div className="center-card">
          <div className="center-row" style={{ marginBottom: 0 }}>
            <span className="center-icon">🌦️</span>
            <div><div className="center-label">Датчик дождя</div></div>
          </div>
          <div className={`rain-badge ${data?.rain ? 'active' : 'inactive'}`} style={{ marginTop: 10 }}>
            {data?.rain ? '🌧️ Идёт дождь' : '☀️ Осадков нет'}
          </div>
        </div>

        <div className="update-time">Обновлено: {formatTime(data?.received_at ?? '')}</div>

        {/* ── Графики динамики ── */}
        <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
          <SensorCharts history={history} />
        </div>
      </aside>
    </div>
  );
}
