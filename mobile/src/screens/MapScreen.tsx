import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polygon, Circle, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { SensorPayload } from '../types/sensors';

const CENTER_LAT = 47.923217;
const CENTER_LNG = 28.578510;
const RADIUS_LAT = 0.0018;
const RADIUS_LNG = 0.00269;
const ROTATION   = 30;

function tempColor(t: number) {
  if (t <= 0) return '#88ccff';
  if (t <= 10) return '#88bbff';
  if (t <= 20) return '#ffffff';
  if (t <= 28) return '#ffcc44';
  return '#ff6633';
}
function soilColor(s: number) {
  if (s < 30) return '#ff6633';
  if (s < 60) return '#ffcc44';
  return '#44cc88';
}
function sectorFill(t: number) {
  if (t <= 0) return '#4488ff';
  if (t <= 10) return '#5096ff';
  if (t <= 20) return '#3ddc84';
  if (t <= 28) return '#ffcc44';
  return '#ff6633';
}

function makeSector(startDeg: number, endDeg: number, steps = 32) {
  const pts: { latitude: number; longitude: number }[] = [
    { latitude: CENTER_LAT, longitude: CENTER_LNG },
  ];
  for (let i = 0; i <= steps; i++) {
    const deg = startDeg + (endDeg - startDeg) * (i / steps);
    const rad = (deg * Math.PI) / 180;
    pts.push({
      latitude: CENTER_LAT + RADIUS_LAT * Math.cos(rad),
      longitude: CENTER_LNG + RADIUS_LNG * Math.sin(rad),
    });
  }
  pts.push({ latitude: CENTER_LAT, longitude: CENTER_LNG });
  return pts;
}

/** Центроид сектора — 60% от центра к краю по биссектрисе */
function sectorCenter(startDeg: number, endDeg: number) {
  const midDeg = (startDeg + endDeg) / 2;
  const rad = (midDeg * Math.PI) / 180;
  const k = 0.6;
  return {
    latitude:  CENTER_LAT + RADIUS_LAT * k * Math.cos(rad),
    longitude: CENTER_LNG + RADIUS_LNG * k * Math.sin(rad),
  };
}

/** Перевод geo-координаты в пиксели overlay */
function geoToPixel(
  lat: number, lng: number,
  region: Region,
  w: number, h: number,
) {
  const x = ((lng - (region.longitude - region.longitudeDelta / 2)) / region.longitudeDelta) * w;
  const y = (((region.latitude + region.latitudeDelta / 2) - lat) / region.latitudeDelta) * h;
  return { x, y };
}

const BEARINGS: [number, number][] = [
  [ROTATION, ROTATION + 90],
  [ROTATION + 90, ROTATION + 180],
  [ROTATION + 180, ROTATION + 270],
  [ROTATION + 270, ROTATION + 360],
];
const SECTORS = BEARINGS.map(([s, e]) => makeSector(s, e));
const LABEL_GEO = BEARINGS.map(([s, e]) => sectorCenter(s, e));

const DEMO: SensorPayload = {
  zones: [
    { zone: 1, temp: 22.5, humidity: 65, online: true },
    { zone: 2, temp: 21.0, humidity: 70, online: true },
    { zone: 3, temp: -1.5, humidity: 85, online: true },
    { zone: 4, temp: 24.0, humidity: 60, online: true },
  ],
  soil_moisture: 48, rain: false, timestamp: 0,
  received_at: new Date().toISOString(),
};

const INITIAL_REGION: Region = {
  latitude: CENTER_LAT,
  longitude: CENTER_LNG,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
};

type Props = { data: SensorPayload | null; connected: boolean };

export default function MapScreen({ data, connected }: Props) {
  const p = data ?? DEMO;
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(INITIAL_REGION);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  }, []);

  const onRegionChange = useCallback((_r: Region) => {
    setRegion(_r);
  }, []);

  // Позиции лейблов в пикселях
  const labelPx = size.w > 0
    ? LABEL_GEO.map(c => geoToPixel(c.latitude, c.longitude, region, size.w, size.h))
    : null;
  const hubPx = size.w > 0
    ? geoToPixel(CENTER_LAT, CENTER_LNG, region, size.w, size.h)
    : null;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#060d18" />

      <View style={s.header}>
        <Text style={s.headerTitle}>Карта поля</Text>
        <View style={[s.dot, connected && s.dotLive]} />
        <Text style={s.dotLabel}>{connected ? 'Live' : 'Offline'}</Text>
      </View>

      <View style={{ flex: 1 }} onLayout={onLayout}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_GOOGLE}
          mapType="satellite"
          initialRegion={INITIAL_REGION}
          onRegionChangeComplete={onRegionChange}
          showsUserLocation={false}
          showsCompass={false}
          scrollEnabled={true}
          zoomEnabled={true}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
        >
          {p.zones.map((zone, i) => {
            const fill = sectorFill(zone.temp);
            return (
              <Polygon
                key={`s${zone.zone}`}
                coordinates={SECTORS[i]}
                fillColor={`${fill}55`}
                strokeColor={fill}
                strokeWidth={2}
              />
            );
          })}
          <Circle
            center={{ latitude: CENTER_LAT, longitude: CENTER_LNG }}
            radius={25}
            fillColor="#0a1e12cc"
            strokeColor={soilColor(p.soil_moisture)}
            strokeWidth={4}
          />
        </MapView>

        {/* Overlay — текстовые метки, привязанные к гео-координатам */}
        {labelPx && (
          <View style={s.overlay} pointerEvents="none">
            {p.zones.map((zone, i) => {
              const t = typeof zone.temp === 'number' && !isNaN(zone.temp) ? zone.temp : 0;
              const h = typeof zone.humidity === 'number' ? zone.humidity : 0;
              const px = labelPx[i];
              return (
                <View
                  key={i}
                  style={[s.label, { left: px.x, top: px.y }]}
                >
                  <Text style={s.labelZone}>ЗОНА {zone.zone}</Text>
                  <Text style={[s.labelTemp, { color: tempColor(t) }]}>
                    {t > 0 ? '+' : ''}{t.toFixed(1)}°
                  </Text>
                  <Text style={s.labelHum}>{h.toFixed(0)}%</Text>
                </View>
              );
            })}

            {/* Хаб почвы */}
            {hubPx && (
              <View style={[s.hub, { left: hubPx.x, top: hubPx.y }]}>
                <Text style={s.hubTitle}>ПОЧВА</Text>
                <Text style={[s.hubValue, { color: soilColor(p.soil_moisture) }]}>
                  {p.soil_moisture}%
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Кнопка возврата к центру */}
        <TouchableOpacity
          style={s.centerBtn}
          onPress={() => {
            mapRef.current?.animateToRegion(INITIAL_REGION, 500);
          }}
        >
          <Text style={s.centerBtnText}>⌖</Text>
        </TouchableOpacity>
      </View>

      {p.rain && (
        <View style={s.rainBar}>
          <Text style={s.rainText}>🌧️ Идёт дождь</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const shadow = {
  textShadowColor: 'rgba(0,0,0,0.95)',
  textShadowOffset: { width: 1, height: 2 },
  textShadowRadius: 10,
} as const;

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#060d18' },
  header:      { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(80,180,100,0.18)' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#3ddc84', flex: 1 },
  dot:         { width: 9, height: 9, borderRadius: 5, backgroundColor: '#555' },
  dotLive:     { backgroundColor: '#3ddc84' },
  dotLabel:    { fontSize: 11, color: '#7aad8a' },

  overlay: { ...StyleSheet.absoluteFillObject },

  label: {
    position: 'absolute',
    alignItems: 'center',
    // Сдвиг чтобы центр метки был точно на координатах
    transform: [{ translateX: -40 }, { translateY: -30 }],
  },
  labelZone: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '700',
    letterSpacing: 1,
    ...shadow,
  },
  labelTemp: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    ...shadow,
  },
  labelHum: {
    fontSize: 13,
    color: '#aaddff',
    fontWeight: '600',
    ...shadow,
  },

  hub: {
    position: 'absolute',
    alignItems: 'center',
    backgroundColor: 'rgba(10,30,18,0.88)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: 'rgba(80,180,100,0.55)',
    transform: [{ translateX: -38 }, { translateY: -20 }],
  },
  hubTitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '800',
    letterSpacing: 2,
  },
  hubValue: {
    fontSize: 20,
    fontWeight: '900',
  },

  centerBtn: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: 'rgba(6,13,24,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(80,180,100,0.4)',
    borderRadius: 30,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerBtnText: { fontSize: 22, color: '#3ddc84', fontWeight: '700' },

  rainBar:  { backgroundColor: 'rgba(10,30,50,0.92)', borderTopWidth: 1, borderTopColor: '#4488ff', padding: 10, alignItems: 'center' },
  rainText: { color: '#88ccff', fontWeight: '600', fontSize: 14 },
});
