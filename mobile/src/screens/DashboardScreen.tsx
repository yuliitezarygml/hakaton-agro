import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SensorPayload, SensorHistory } from '../types/sensors';
import SensorCharts from '../components/SensorCharts';

// ── Цветовые утилиты ──────────────────────────────────────────────
function tempColor(t: number) {
  if (t <= 0)  return '#88ccff';
  if (t <= 10) return '#88bbff';
  if (t <= 20) return '#3ddc84';
  if (t <= 28) return '#ffcc44';
  return '#ff6633';
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

type Props = {
  data: SensorPayload | null;
  history: SensorHistory;
  connected: boolean;
};

export default function DashboardScreen({ data, history, connected }: Props) {
  const p = data ?? DEMO;
  const isDemo = data === null;

  const formatTime = (iso: string) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleTimeString('ru-RU'); } catch { return '—'; }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#060d18" />

      {/* Шапка */}
      <View style={styles.header}>
        <Text style={styles.headerLogo}>🌿</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>AgriMap</Text>
          <Text style={styles.headerSub}>Мониторинг садового участка</Text>
        </View>
        <View style={[styles.statusDot, connected && styles.statusDotLive]} />
        <Text style={styles.statusLabel}>{connected ? 'Live' : 'Offline'}</Text>
      </View>

      {isDemo && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>📡 Демо-режим — ESP32 не подключён</Text>
        </View>
      )}

      {p.rain && (
        <View style={styles.rainBanner}>
          <Text style={styles.rainBannerText}>🌧️ Идёт дождь</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Зоны */}
        <Text style={styles.sectionTitle}>Зоны (DHT11)</Text>
        {p.zones.map(z => {
          const temp     = typeof z.temp === 'number' && !isNaN(z.temp) ? z.temp : 0;
          const humidity = typeof z.humidity === 'number' && !isNaN(z.humidity) ? z.humidity : 0;
          const freeze   = temp < 0;
          const color    = tempColor(temp);
          return (
            <View key={z.zone} style={[styles.zoneCard, freeze && styles.zoneCardFreeze]}>
              <View style={styles.zoneHeader}>
                <Text style={styles.zoneName}>Зона {z.zone}</Text>
                <View style={[styles.zoneBadge, freeze ? styles.badgeFreeze : styles.badgeNormal]}>
                  <Text style={[styles.zoneBadgeText, { color: freeze ? '#88ccff' : '#3ddc84' }]}>
                    {freeze ? '❄️ Мороз' : '✅ Норма'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.zoneTemp, { color }]}>
                {temp > 0 ? `+${temp.toFixed(1)}` : temp.toFixed(1)}°C
              </Text>
              <Text style={styles.zoneHum}>💧 {humidity.toFixed(0)}%</Text>
            </View>
          );
        })}

        {/* Центральный хаб */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Центр</Text>

        <View style={styles.centerCard}>
          <View style={styles.centerRow}>
            <Text style={styles.centerIcon}>🌱</Text>
            <View>
              <Text style={styles.centerLabel}>Влажность почвы</Text>
              <Text style={[styles.centerValue, { color: soilColor(p.soil_moisture) }]}>
                {p.soil_moisture}%
              </Text>
            </View>
          </View>
          <View style={styles.soilTrack}>
            <View style={[styles.soilFill, {
              width: `${p.soil_moisture}%` as any,
              backgroundColor: soilColor(p.soil_moisture),
            }]} />
          </View>
        </View>

        <View style={styles.centerCard}>
          <View style={styles.centerRow}>
            <Text style={styles.centerIcon}>🌦️</Text>
            <Text style={styles.centerLabel}>Датчик дождя</Text>
          </View>
          <View style={[styles.rainBadge, p.rain ? styles.rainActive : styles.rainInactive]}>
            <Text style={[styles.rainText, { color: p.rain ? '#88ccff' : '#ffdd88' }]}>
              {p.rain ? '🌧️ Идёт дождь' : '☀️ Осадков нет'}
            </Text>
          </View>
        </View>

        <Text style={styles.updateTime}>Обновлено: {formatTime(p.received_at)}</Text>

        {/* Графики */}
        <View style={styles.chartsDivider} />
        <SensorCharts history={history} />

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#060d18' },
  header:       { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(80,180,100,0.18)' },
  headerLogo:   { fontSize: 24 },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: '#3ddc84', letterSpacing: -0.5 },
  headerSub:    { fontSize: 11, color: '#7aad8a' },
  statusDot:    { width: 9, height: 9, borderRadius: 5, backgroundColor: '#555' },
  statusDotLive:{ backgroundColor: '#3ddc84' },
  statusLabel:  { fontSize: 11, color: '#7aad8a' },

  demoBanner:   { backgroundColor: 'rgba(255,200,50,0.08)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,200,50,0.2)', padding: 8, alignItems: 'center' },
  demoBannerText:{ fontSize: 12, color: '#ffdd88' },
  rainBanner:   { backgroundColor: 'rgba(68,136,255,0.1)', borderBottomWidth: 1, borderBottomColor: 'rgba(68,136,255,0.3)', padding: 8, alignItems: 'center' },
  rainBannerText:{ fontSize: 13, fontWeight: '600', color: '#88ccff' },

  scroll:       { padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: '#7aad8a', marginBottom: 10 },

  zoneCard:       { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(80,180,100,0.18)', borderRadius: 16, padding: 14, marginBottom: 10 },
  zoneCardFreeze: { borderColor: 'rgba(68,136,255,0.5)' },
  zoneHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  zoneName:       { fontSize: 13, fontWeight: '600', color: '#7aad8a' },
  zoneBadge:      { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeNormal:    { backgroundColor: 'rgba(61,220,132,0.15)' },
  badgeFreeze:    { backgroundColor: 'rgba(68,136,255,0.2)' },
  zoneBadgeText:  { fontSize: 11, fontWeight: '700' },
  zoneTemp:       { fontSize: 32, fontWeight: '800', letterSpacing: -1, lineHeight: 36, marginBottom: 4 },
  zoneHum:        { fontSize: 13, color: '#7aad8a' },

  centerCard:   { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(80,180,100,0.18)', borderRadius: 16, padding: 14, marginBottom: 10 },
  centerRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  centerIcon:   { fontSize: 22 },
  centerLabel:  { fontSize: 12, color: '#7aad8a' },
  centerValue:  { fontSize: 22, fontWeight: '700' },
  soilTrack:    { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  soilFill:     { height: '100%', borderRadius: 3 },
  rainBadge:    { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
  rainActive:   { backgroundColor: 'rgba(68,136,255,0.18)', borderWidth: 1, borderColor: 'rgba(68,136,255,0.35)' },
  rainInactive: { backgroundColor: 'rgba(255,200,50,0.12)', borderWidth: 1, borderColor: 'rgba(255,200,50,0.2)' },
  rainText:     { fontSize: 13, fontWeight: '600' },

  updateTime:   { fontSize: 10, color: '#446655', textAlign: 'center', marginVertical: 8 },
  chartsDivider:{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', marginVertical: 8 },
});
