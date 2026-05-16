import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { Alert as AlertType, AlertLevel } from '../hooks/useAlerts';

const { width: SCREEN_W } = Dimensions.get('window');

const COLORS: Record<AlertLevel, { bg: string; border: string; text: string; icon: string }> = {
  critical: { bg: 'rgba(50, 10, 10, 0.95)', border: '#ff4444', text: '#ff6666', icon: '🚨' },
  warning:  { bg: 'rgba(50, 40, 10, 0.95)', border: '#ffcc44', text: '#ffdd88', icon: '⚠️' },
  info:     { bg: 'rgba(10, 20, 50, 0.95)', border: '#4488ff', text: '#88ccff', icon: '🌧️' },
};

function AlertBanner({ alert, onDismiss }: { alert: AlertType; onDismiss: () => void }) {
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Slide in
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start();

    // Pulse for critical
    if (alert.level === 'critical') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }
  }, []);

  const c = COLORS[alert.level];

  return (
    <Animated.View
      style={[
        s.banner,
        {
          backgroundColor: c.bg,
          borderColor: c.border,
          transform: [{ translateY: slideAnim }],
          opacity: alert.level === 'critical' ? pulseAnim : 1,
        },
      ]}
    >
      <View style={s.bannerContent}>
        <Text style={s.bannerIcon}>{c.icon}</Text>
        <View style={s.bannerText}>
          <Text style={[s.bannerTitle, { color: c.text }]}>{alert.title}</Text>
          <Text style={s.bannerMessage}>{alert.message}</Text>
        </View>
        <TouchableOpacity onPress={onDismiss} style={s.dismissBtn}>
          <Text style={s.dismissText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

type Props = {
  alerts: AlertType[];
  onDismiss: (id: string) => void;
};

export default function AlertOverlay({ alerts, onDismiss }: Props) {
  const hasCritical = alerts.some(a => a.level === 'critical');
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    async function playSound() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/alarm.mp3')
        );
        soundRef.current = sound;
        await sound.playAsync();
      } catch (e) {
        console.error('Error playing sound', e);
      }
    }

    if (hasCritical) {
      playSound();
    } else {
      if (soundRef.current) {
        soundRef.current.stopAsync();
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    }

    return () => {
      if (soundRef.current) {
        soundRef.current.stopAsync();
        soundRef.current.unloadAsync();
      }
    };
  }, [hasCritical]);

  if (alerts.length === 0) return null;

  return (
    <View style={s.overlay} pointerEvents="box-none">
      {alerts.map((alert, i) => (
        <View key={alert.id} style={{ marginTop: i * 4 }}>
          <AlertBanner
            alert={alert}
            onDismiss={() => onDismiss(alert.id)}
          />
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingTop: 50,
    paddingHorizontal: 12,
  },
  banner: {
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  bannerIcon: {
    fontSize: 24,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  bannerMessage: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 15,
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '700',
  },
});
