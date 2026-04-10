export interface GpsMessage {
  device_id: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  timestamp: string;
}

export interface FleetEventMessage {
  device_id: string;
  type: 'DROWSINESS' | 'SPEEDING' | 'HARSH_BRAKING' | 'COLLISION_WARNING';
  severity: 'LOW' | 'MEDIUM' | 'CRITICAL';
  lat: number;
  lng: number;
  timestamp: string;
}
