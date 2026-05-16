'use client';

import dynamic from 'next/dynamic';
import { SensorPayload } from '@/types/sensors';

// Динамически импортируем саму карту, так как Leaflet использует объект window (не работает на сервере)
const DynamicMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#88ccff' }}>
      Загрузка спутниковой карты...
    </div>
  ),
});

export default function GardenMap({ payload }: { payload: SensorPayload | null }) {
  return <DynamicMap payload={payload} />;
}
