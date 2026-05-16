'use client';

import { MapContainer, TileLayer, Polygon, Marker, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { SensorPayload } from '@/types/sensors';

// ── Helpers ───────────────────────────────────────────────────────────────────
function tempColor(t: number) {
  if (t <= 0) return { fill: '#4488ff', border: '#88ccff' };
  if (t <= 10) return { fill: '#5096ff', border: '#66aaff' };
  if (t <= 20) return { fill: '#3ddc84', border: '#5effa0' };
  if (t <= 28) return { fill: '#ffcc44', border: '#ffe080' };
  return { fill: '#ff6633', border: '#ff9966' };
}

function soilColor(s: number) {
  if (s < 30) return '#ff6633';
  if (s < 60) return '#ffcc44';
  return '#44cc88';
}

const DEMO: SensorPayload = {
  zones: [
    { zone: 1, temp: 22.5, humidity: 65, online: true },
    { zone: 2, temp: 21.0, humidity: 70, online: true },
    { zone: 3, temp: -1.5, humidity: 85, online: true },
    { zone: 4, temp: 24.0, humidity: 60, online: true },
  ],
  soil_moisture: 48,
  rain: false,
  timestamp: 0,
  received_at: new Date().toISOString(),
};

// ── Координаты поля ──────────────────────────────────────────────────────────
const CENTER: [number, number] = [47.92377811835826, 28.57821840533287];

// 200 м ≈ 0.0018° широты, ≈ 0.00269° долготы (на 48° с.ш.)
const RADIUS_LAT = 0.0018;
const RADIUS_LNG = 0.00269;

// Поворот на 30° по часовой стрелке
const ROTATION_DEG = 30;

// ── Генерация сектора (pie-slice) ────────────────────────────────────────────
function makeSector(
  center: [number, number],
  startBearing: number, // градусы, 0°=Север, по часовой
  endBearing: number,
  steps: number = 32
): [number, number][] {
  const pts: [number, number][] = [[center[0], center[1]]];
  for (let i = 0; i <= steps; i++) {
    const deg = startBearing + (endBearing - startBearing) * (i / steps);
    const rad = (deg * Math.PI) / 180;
    pts.push([
      center[0] + RADIUS_LAT * Math.cos(rad),
      center[1] + RADIUS_LNG * Math.sin(rad),
    ]);
  }
  pts.push([center[0], center[1]]);
  return pts;
}

// 4 сектора по 90°, повёрнуты на 30° CW
const SECTOR_BEARINGS: [number, number][] = [
  [ROTATION_DEG, ROTATION_DEG + 90],   // Зона 1
  [ROTATION_DEG + 90, ROTATION_DEG + 180],  // Зона 2
  [ROTATION_DEG + 180, ROTATION_DEG + 270],  // Зона 3
  [ROTATION_DEG + 270, ROTATION_DEG + 360],  // Зона 4
];

const ZONES_SECTORS = SECTOR_BEARINGS.map(([s, e]) => makeSector(CENTER, s, e));

// Центр надписи — на 55% радиуса от центра, по середине сектора
const ZONE_CENTERS: [number, number][] = SECTOR_BEARINGS.map(([s, e]) => {
  const midDeg = (s + e) / 2;
  const rad = (midDeg * Math.PI) / 180;
  return [
    CENTER[0] + RADIUS_LAT * 0.55 * Math.cos(rad),
    CENTER[1] + RADIUS_LNG * 0.55 * Math.sin(rad),
  ];
});

// Создаём HTML-иконку с надписью (температура, влажность)
function makeLabel(zone: number, temp: number, humidity: number, freeze: boolean, offline: boolean) {
  const tempStr = offline
    ? '<div style="font-size:12px;color:#ff6666;font-weight:800;margin-top:2px">ОФФЛАЙН</div>'
    : `<div style="font-size:22px;font-weight:900;color:${freeze ? '#aaddff' : '#fff'};line-height:1.1">${temp > 0 ? '+' : ''}${temp}°</div>
       <div style="font-size:12px;color:#aaddff">💧 ${humidity}%</div>`;

  return L.divIcon({
    className: 'zone-label',
    html: `<div style="text-align:center;text-shadow:0 2px 6px rgba(0,0,0,0.9)">
      <div style="font-size:10px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px;font-weight:700">Зона ${zone}</div>
      ${tempStr}
    </div>`,
    iconSize: [100, 60],
    iconAnchor: [50, 30],
  });
}

export default function LeafletMap({ payload }: { payload: SensorPayload | null }) {
  const p = payload ?? DEMO;

  return (
    <div style={{ width: '100%', height: '100%', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(80,180,100,0.3)', position: 'relative' }}>

      {/* ── Индикатор Дождя ── */}
      {p.rain && (
        <div style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'rgba(10,30,50,0.85)', border: '1px solid #4488ff',
          padding: '8px 20px', borderRadius: 20, color: '#88ccff', fontWeight: 'bold',
          boxShadow: '0 0 15px rgba(68,136,255,0.4)', fontSize: '0.9rem',
        }}>
          🌧️ Идёт дождь
        </div>
      )}

      {/* ── Карта ── */}
      <MapContainer
        center={CENTER}
        zoom={16}
        style={{ width: '100%', height: '100%', background: '#0a1410' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
          maxZoom={19}
        />

        {/* ── 4 сектора (круглое поле) ── */}
        {p.zones.map((zone, i) => {
          const isOffline = !zone.online;
          const colors = isOffline ? { fill: '#333333', border: '#777777' } : tempColor(zone.temp);
          const freeze = !isOffline && zone.temp < 0;

          return (
            <Polygon
              key={`sector-${zone.zone}`}
              positions={ZONES_SECTORS[i]}
              pathOptions={{
                color: colors.border,
                fillColor: colors.fill,
                fillOpacity: freeze ? 0.55 : (isOffline ? 0.45 : 0.3),
                weight: 2,
                dashArray: freeze || isOffline ? undefined : '6, 6',
              }}
            />
          );
        })}

        {/* ── Надписи в центре каждого сектора ── */}
        {p.zones.map((zone, i) => {
          const isOffline = !zone.online;
          const freeze = !isOffline && zone.temp < 0;
          return (
            <Marker
              key={`label-${zone.zone}`}
              position={ZONE_CENTERS[i]}
              icon={makeLabel(zone.zone, zone.temp, zone.humidity, freeze, isOffline)}
              interactive={false}
            />
          );
        })}

        {/* ── Центральный хаб (Почва) ── */}
        <CircleMarker
          center={CENTER}
          radius={32}
          pathOptions={{
            color: soilColor(p.soil_moisture),
            fillColor: '#0a1e12',
            fillOpacity: 0.9,
            weight: 3,
          }}
        >
          <Tooltip permanent direction="center" className="hub-tooltip">
            <div style={{ textAlign: 'center', fontWeight: 'bold', color: soilColor(p.soil_moisture), textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
              <div style={{ fontSize: '0.55rem', color: '#fff', opacity: 0.7 }}>ПОЧВА</div>
              {p.soil_moisture}%
            </div>
          </Tooltip>
        </CircleMarker>

      </MapContainer>

      <style>{`
        .zone-label { background: none !important; border: none !important; }
        .leaflet-tooltip.hub-tooltip {
          background: transparent; border: none; box-shadow: none; padding: 0;
        }
      `}</style>
    </div>
  );
}
