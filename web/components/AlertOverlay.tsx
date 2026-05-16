'use client';
import { useEffect, useRef } from 'react';
import { Alert, AlertLevel } from '@/hooks/useAlerts';

const COLORS: Record<AlertLevel, { bg: string; border: string; text: string; icon: string }> = {
  critical: { bg: 'rgba(50, 10, 10, 0.95)', border: '#ff4444', text: '#ff6666', icon: '🚨' },
  warning:  { bg: 'rgba(50, 40, 10, 0.95)', border: '#ffcc44', text: '#ffdd88', icon: '⚠️' },
  info:     { bg: 'rgba(10, 20, 50, 0.95)', border: '#4488ff', text: '#88ccff', icon: '🌧️' },
};

let audioEl: HTMLAudioElement | null = null;

function playAlarmSound() {
  try {
    if (!audioEl) {
      audioEl = new Audio('/alarm.mp3');
      audioEl.volume = 1.0;
    }
    // Rewind and play
    audioEl.currentTime = 0;
    audioEl.play().catch(e => console.error('Audio play failed', e));
  } catch (e) {
    console.error('Audio setup failed', e);
  }
}

export default function AlertOverlay({ alerts, onDismiss }: { alerts: Alert[]; onDismiss: (id: string) => void }) {
  const hasCritical = alerts.some(a => a.level === 'critical');

  useEffect(() => {
    if (hasCritical) {
      playAlarmSound(); // Play once when critical alert appears
    }
  }, [hasCritical]);

  if (alerts.length === 0) return null;

  return (
    <div className="alert-overlay">
      {alerts.map((alert) => {
        const c = COLORS[alert.level];
        return (
          <div key={alert.id} className={`alert-banner ${alert.level === 'critical' ? 'pulse-anim' : ''}`} style={{
            backgroundColor: c.bg,
            border: `1px solid ${c.border}`
          }}>
            <div className="alert-icon">{c.icon}</div>
            <div className="alert-content">
              <div className="alert-title" style={{ color: c.text }}>{alert.title}</div>
              <div className="alert-message">{alert.message}</div>
            </div>
            <button className="alert-dismiss" onClick={() => onDismiss(alert.id)}>✕</button>
          </div>
        );
      })}
    </div>
  );
}
