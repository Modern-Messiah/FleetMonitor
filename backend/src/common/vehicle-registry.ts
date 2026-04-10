export interface VehicleSeed {
  deviceId: string;
  driverName: string;
  licensePlate: string;
}

export const VEHICLE_REGISTRY: VehicleSeed[] = [
  { deviceId: 'ALM-001', driverName: 'Aibek Nurtayev', licensePlate: 'KZ 100 AAA 02' },
  { deviceId: 'ALM-002', driverName: 'Diana Sarsenova', licensePlate: 'KZ 101 AAB 02' },
  { deviceId: 'ALM-003', driverName: 'Ruslan Omarov', licensePlate: 'KZ 102 AAC 02' },
  { deviceId: 'ALM-004', driverName: 'Nuraiym Bekova', licensePlate: 'KZ 103 AAD 02' },
  { deviceId: 'ALM-005', driverName: 'Yerlan Mukashev', licensePlate: 'KZ 104 AAE 02' },
  { deviceId: 'ALM-006', driverName: 'Alina Zheksen', licensePlate: 'KZ 105 AAF 02' },
  { deviceId: 'ALM-007', driverName: 'Nursultan Yesdaulet', licensePlate: 'KZ 106 AAG 02' },
  { deviceId: 'ALM-008', driverName: 'Samal Abilova', licensePlate: 'KZ 107 AAH 02' },
  { deviceId: 'ALM-009', driverName: 'Marat Seithanov', licensePlate: 'KZ 108 AAI 02' },
  { deviceId: 'ALM-010', driverName: 'Aruzhan Imanova', licensePlate: 'KZ 109 AAJ 02' },
  { deviceId: 'ALM-011', driverName: 'Talgat Tursynbek', licensePlate: 'KZ 110 AAK 02' },
  { deviceId: 'ALM-012', driverName: 'Saniya Duysen', licensePlate: 'KZ 111 AAL 02' },
  { deviceId: 'ALM-013', driverName: 'Kanat Baikenov', licensePlate: 'KZ 112 AAM 02' },
  { deviceId: 'ALM-014', driverName: 'Zhanel Kenes', licensePlate: 'KZ 113 AAN 02' },
  { deviceId: 'ALM-015', driverName: 'Dastan Abdrakhman', licensePlate: 'KZ 114 AAO 02' },
  { deviceId: 'ALM-016', driverName: 'Madina Utebayeva', licensePlate: 'KZ 115 AAP 02' },
  { deviceId: 'ALM-017', driverName: 'Ilyas Yeleusizov', licensePlate: 'KZ 116 AAQ 02' },
  { deviceId: 'ALM-018', driverName: 'Aisana Kairat', licensePlate: 'KZ 117 AAR 02' },
  { deviceId: 'ALM-019', driverName: 'Bauyrzhan Sapar', licensePlate: 'KZ 118 AAS 02' },
  { deviceId: 'ALM-020', driverName: 'Tomiris Akhmet', licensePlate: 'KZ 119 AAT 02' },
];

export const VEHICLE_REGISTRY_MAP = new Map(
  VEHICLE_REGISTRY.map((vehicle) => [vehicle.deviceId, vehicle]),
);
