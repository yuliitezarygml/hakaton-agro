import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SensorHistory } from '../types/sensors';
import Svg, { Polyline, Polygon, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const ZONE_COLORS = [
  { temp: '#ffcc44', hum: '#4488ff' },
  { temp: '#ff8844', hum: '#44aaff' },
  { temp: '#44dd88', hum: '#6666ff' },
  { temp: '#ff6666', hum: '#44cccc' },
];

function Sparkline({
  data, color, label, unit,
}: {
  data: number[]; color: string; label: string; unit: string;
}) {
  const W = 220, H = 40, PAD = 2;

  if (data.length < 2) {
    return (
      <View style={styles.sparkRow}>
        <Text style={[styles.sparkLabel, { color }]}>{label}</Text>
        <Text style={styles.sparkNoData}>ожидание…</Text>
      </View>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const current = data[data.length - 1];
  const prev    = data[data.length - 2];
  const trend   = current - prev > 0.2 ? '↑' : current - prev < -0.2 ? '↓' : '→';
  const trendColor = current - prev > 0.2 ? '#44dd88' : current - prev < -0.2 ? '#ff6666' : '#888';

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = PAD + (1 - (v - min) / range) * (H - PAD * 2);
    return { x, y };
  });

  const polyPoints = pts.map(p => `${p.x},${p.y}`).join(' ');
  const fillPoints = `0,${H} ${polyPoints} ${W},${H}`;
  const lastPt = pts[pts.length - 1];
  const gradId = `g${label}`;

  return (
    <View style={styles.sparkWrap}>
      <View style={styles.sparkRow}>
        <Text style={styles.sparkLabel}>{label}</Text>
        <Text style={[styles.sparkValue, { color }]}>
          {current.toFixed(1)}{unit}{'  '}
          <Text style={{ color: trendColor }}>{trend}</Text>
        </Text>
      </View>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Polygon points={fillPoints} fill={`url(#${gradId})`} />
        <Polyline
          points={polyPoints}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle cx={lastPt.x} cy={lastPt.y} r={3} fill={color} />
      </Svg>
    </View>
  );
}

export default function SensorCharts({ history }: { history: SensorHistory }) {
  if (history.length < 2) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>📊 Графики появятся после накопления данных…</Text>
      </View>
    );
  }

  const zoneCount = history[0]?.zones?.length ?? 4;
  const soilData  = history.map(h => h.soil_moisture);

  return (
    <View>
      <Text style={styles.sectionTitle}>📈 Динамика</Text>
      {Array.from({ length: zoneCount }).map((_, zi) => {
        const temps = history.map(h => h.zones[zi]?.temp ?? 0);
        const hums  = history.map(h => h.zones[zi]?.humidity ?? 0);
        const colors = ZONE_COLORS[zi] ?? ZONE_COLORS[0];
        return (
          <View key={zi} style={styles.card}>
            <Text style={styles.cardTitle}>Зона {zi + 1}</Text>
            <Sparkline data={temps} color={colors.temp} label="Темп" unit="°" />
            <Sparkline data={hums}  color={colors.hum}  label="Влажн" unit="%" />
          </View>
        );
      })}
      <View style={styles.card}>
        <Sparkline data={soilData} color="#44cc88" label="Почва" unit="%" />
      </View>
      <Text style={styles.meta}>
        {history.length} замеров · ~{Math.round(history.length * 10 / 60)} мин
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8, marginTop: 4 },
  card:       { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(80,180,100,0.18)', borderRadius: 12, padding: 10, marginBottom: 8 },
  cardTitle:  { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginBottom: 6 },
  sparkWrap:  { marginBottom: 6 },
  sparkRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  sparkLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 },
  sparkValue: { fontSize: 12, fontWeight: '700' },
  sparkNoData:{ fontSize: 10, color: '#555' },
  empty:      { padding: 16, alignItems: 'center' },
  emptyText:  { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  meta:       { fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 4 },
});
