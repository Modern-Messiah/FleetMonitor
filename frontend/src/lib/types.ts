export type Severity = 'LOW' | 'MEDIUM' | 'CRITICAL';
export type EventType =
  | 'DROWSINESS'
  | 'SPEEDING'
  | 'HARSH_BRAKING'
  | 'COLLISION_WARNING';

export interface VehicleState {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  timestamp: string;
}

export interface Vehicle {
  id: string;
  deviceId: string;
  driverName: string;
  licensePlate: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  state: VehicleState | null;
}

export interface FleetEvent {
  id: string;
  vehicleId: string;
  type: EventType;
  severity: Severity;
  lat: number;
  lng: number;
  timestamp: string;
  groupCount: number;
}

export interface GpsUpdate {
  vehicleId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  timestamp: string;
}

export interface VehicleStatus {
  vehicleId: string;
  isOnline: boolean;
}

export interface FleetSnapshotItem {
  vehicleId: string;
  deviceId: string;
  driverName: string;
  licensePlate: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  timestamp: string;
}

export interface EventsListResponse {
  items: Array<
    FleetEvent & {
      vehicle: {
        id: string;
        deviceId: string;
        driverName: string;
        licensePlate: string;
      };
    }
  >;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
