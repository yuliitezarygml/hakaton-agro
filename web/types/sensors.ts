export interface ZoneData {
  zone: number;
  temp: number;
  humidity: number;
  online?: boolean;
}

export interface SensorPayload {
  zones: ZoneData[];
  soil_moisture: number;
  rain: boolean;
  timestamp: number;
  received_at: string;
}

// Тип для истории — массив SensorPayload
export type SensorHistory = SensorPayload[];
