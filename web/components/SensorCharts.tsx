'use client';

import { SensorHistory } from '@/types/sensors';

// ── Цвета для зон ──────────────────────────────────────────────────
const ZONE_COLORS = [
  { temp: '#ffcc44', hum: '#4488ff' },
  { temp: '#ff8844', hum: '#44aaff' },
  { temp: '#44dd88', hum: '#6666ff' },
  { temp: '#ff6666', hum: '#44cccc' },
];

// ── SVG спарклайн ──────────────────────────────────────────────────
function Sparkline({
  data,
  color,
  width = 200,
  height = 40,
  label,
  unit,
  current,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  label: string;
  unit: string;
  current: number;
}) {
  if (data.length < 2) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.4 }}>
        <span style={{ fontSize: '0.7rem', color: '#aaa' }}>{label}: ожидание данных…</span>
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  // Градиент для заливки под линией
  const fillPoints = `0,${height} ${points.join(' ')} ${width},${height}`;
  const gradientId = `grad-${label.replace(/\s/g, '')}-${color.replace('#', '')}`;

  const trend = data.length >= 2 ? data[data.length - 1] - data[data.length - 2] : 0;
  const trendIcon = trend > 0.2 ? '↑' : trend < -0.2 ? '↓' : '→';
  const trendColor = trend > 0.2 ? '#44dd88' : trend < -0.2 ? '#ff6666' : '#888';

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>
          {label}
        </span>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color }}>
          {current.toFixed(1)}{unit}
          <span style={{ color: trendColor, marginLeft: 4, fontSize: '0.7rem' }}>{trendIcon}</span>
        </span>
      </div>
      <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={fillPoints} fill={`url(#${gradientId})`} />
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Точка на последнем значении */}
        {data.length > 0 && (() => {
          const lastX = width;
          const lastY = padding + (1 - (data[data.length - 1] - min) / range) * (height - padding * 2);
          return (
            <>
              <circle cx={lastX} cy={lastY} r={3} fill={color} />
              <circle cx={lastX} cy={lastY} r={5} fill={color} opacity={0.3}>
                <animate attributeName="r" from="3" to="8" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite" />
              </circle>
            </>
          );
        })()}
      </svg>
    </div>
  );
}

// ── Основной компонент ─────────────────────────────────────────────
export default function SensorCharts({ history }: { history: SensorHistory }) {
  if (history.length < 2) {
    return (
      <div style={{
        padding: '16px 12px',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.3)',
        fontSize: '0.75rem',
      }}>
        📊 Графики появятся после накопления данных…
      </div>
    );
  }

  // Собираем данные для каждой зоны
  const zoneCount = history[0]?.zones?.length ?? 4;
  const soilData = history.map(h => h.soil_moisture);

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{
        fontSize: '0.7rem',
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        fontWeight: 700,
        marginBottom: 8,
        paddingLeft: 4,
      }}>
        📈 Динамика
      </div>

      {Array.from({ length: zoneCount }).map((_, zi) => {
        const temps = history.map(h => h.zones[zi]?.temp ?? 0);
        const hums = history.map(h => h.zones[zi]?.humidity ?? 0);
        const lastTemp = temps[temps.length - 1];
        const lastHum = hums[hums.length - 1];
        const colors = ZONE_COLORS[zi] ?? ZONE_COLORS[0];

        return (
          <div key={zi} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: '8px 10px',
            marginBottom: 6,
          }}>
            <div style={{
              fontSize: '0.65rem',
              color: 'rgba(255,255,255,0.5)',
              fontWeight: 700,
              marginBottom: 4,
            }}>
              Зона {zi + 1}
            </div>
            <Sparkline data={temps} color={colors.temp} label="Темп" unit="°" current={lastTemp} />
            <Sparkline data={hums} color={colors.hum} label="Влажн" unit="%" current={lastHum} />
          </div>
        );
      })}

      {/* Почва */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        padding: '8px 10px',
        marginBottom: 6,
      }}>
        <Sparkline
          data={soilData}
          color="#44cc88"
          label="Почва"
          unit="%"
          current={soilData[soilData.length - 1]}
        />
      </div>

      <div style={{
        fontSize: '0.6rem',
        color: 'rgba(255,255,255,0.2)',
        textAlign: 'center',
        marginTop: 4,
      }}>
        {history.length} замеров · ~{Math.round(history.length * 10 / 60)} мин
      </div>
    </div>
  );
}
