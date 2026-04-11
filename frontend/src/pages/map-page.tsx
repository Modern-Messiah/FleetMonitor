import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import throttle from 'lodash.throttle';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { toast } from 'sonner';
import { useFleetSocket } from '@/hooks/use-fleet-socket';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/date';
import { FleetEvent, FleetSnapshotItem, GpsUpdate, Vehicle } from '@/lib/types';
import { SeverityBadge } from '@/components/severity-badge';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface LiveVehicle {
  id: string;
  deviceId: string;
  driverName: string;
  licensePlate: string;
  lat: number | null;
  lng: number | null;
  speed: number;
  heading: number;
  timestamp: string | null;
  isOnline: boolean;
  lastSeenMs: number;
}

const center: [number, number] = [43.238, 76.945];

function formatEventType(type: FleetEvent['type']) {
  switch (type) {
    case 'DROWSINESS':
      return 'Сонливость';
    case 'SPEEDING':
      return 'Превышение скорости';
    case 'HARSH_BRAKING':
      return 'Резкое торможение';
    case 'COLLISION_WARNING':
      return 'Опасность столкновения';
    default:
      return type;
  }
}

function onlineIcon(isOnline: boolean) {
  const color = isOnline ? '#2563eb' : '#64748b';
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.25)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function applyGpsUpdate(current: LiveVehicle, update: GpsUpdate): LiveVehicle {
  return {
    ...current,
    lat: update.lat,
    lng: update.lng,
    speed: update.speed,
    heading: update.heading,
    timestamp: update.timestamp,
    isOnline: true,
    lastSeenMs: Date.now(),
  };
}

function applySnapshot(current: LiveVehicle, snapshot: FleetSnapshotItem): LiveVehicle {
  return {
    ...current,
    id: snapshot.vehicleId,
    deviceId: snapshot.deviceId,
    driverName: snapshot.driverName,
    licensePlate: snapshot.licensePlate,
    lat: snapshot.lat,
    lng: snapshot.lng,
    speed: snapshot.speed,
    heading: snapshot.heading,
    timestamp: snapshot.timestamp,
    isOnline: true,
    lastSeenMs: Date.now(),
  };
}

function asLiveVehicle(vehicle: Vehicle): LiveVehicle {
  return {
    id: vehicle.id,
    deviceId: vehicle.deviceId,
    driverName: vehicle.driverName,
    licensePlate: vehicle.licensePlate,
    lat: vehicle.state?.lat ?? null,
    lng: vehicle.state?.lng ?? null,
    speed: vehicle.state?.speed ?? 0,
    heading: vehicle.state?.heading ?? 0,
    timestamp: vehicle.state?.timestamp ?? null,
    isOnline: Boolean(vehicle.state),
    lastSeenMs: vehicle.state ? Date.parse(vehicle.state.timestamp) : 0,
  };
}

export function MapPage() {
  const { data: vehicles = [], isLoading, isError } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const response = await api.get<Vehicle[]>('/vehicles');
      return response.data;
    },
  });

  const [liveVehicles, setLiveVehicles] = useState<Record<string, LiveVehicle>>({});
  const [eventsByVehicle, setEventsByVehicle] = useState<Record<string, FleetEvent[]>>({});
  const throttledUpdates = useRef<Record<string, (update: GpsUpdate) => void>>({});

  useEffect(() => {
    if (!vehicles.length) {
      return;
    }

    setLiveVehicles((previous) => {
      const next = { ...previous };
      vehicles.forEach((vehicle) => {
        next[vehicle.id] = previous[vehicle.id]
          ? { ...previous[vehicle.id], ...asLiveVehicle(vehicle) }
          : asLiveVehicle(vehicle);
      });
      return next;
    });
  }, [vehicles]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setLiveVehicles((previous) => {
        const next = { ...previous };
        Object.keys(next).forEach((vehicleId) => {
          const vehicle = next[vehicleId];
          if (vehicle.isOnline && now - vehicle.lastSeenMs > 15_000) {
            next[vehicleId] = {
              ...vehicle,
              isOnline: false,
            };
          }
        });
        return next;
      });
    }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useFleetSocket({
    onGpsUpdate: (update) => {
      const runUpdate =
        throttledUpdates.current[update.vehicleId] ||
        throttle(
          (payload: GpsUpdate) => {
            setLiveVehicles((previous) => {
              const current = previous[payload.vehicleId];
              if (!current) {
                return previous;
              }
              return {
                ...previous,
                [payload.vehicleId]: applyGpsUpdate(current, payload),
              };
            });
          },
          1000,
          { leading: true, trailing: true },
        );

      throttledUpdates.current[update.vehicleId] = runUpdate;
      runUpdate(update);
    },
    onVehicleStatus: (status) => {
      setLiveVehicles((previous) => {
        const current = previous[status.vehicleId];
        if (!current) {
          return previous;
        }

        return {
          ...previous,
          [status.vehicleId]: {
            ...current,
            isOnline: status.isOnline,
            lastSeenMs: status.isOnline ? Date.now() : current.lastSeenMs,
          },
        };
      });
    },
    onFleetSnapshot: (snapshot) => {
      setLiveVehicles((previous) => {
        const next = { ...previous };
        snapshot.forEach((item) => {
          const current = next[item.vehicleId];
          if (!current) {
            next[item.vehicleId] = {
              id: item.vehicleId,
              deviceId: item.deviceId,
              driverName: item.driverName,
              licensePlate: item.licensePlate,
              lat: item.lat,
              lng: item.lng,
              speed: item.speed,
              heading: item.heading,
              timestamp: item.timestamp,
              isOnline: true,
              lastSeenMs: Date.now(),
            };
            return;
          }

          next[item.vehicleId] = applySnapshot(current, item);
        });

        return next;
      });
    },
    onEventsHistory: (history) => {
      setEventsByVehicle((previous) => {
        const next = { ...previous };

        history.forEach((event) => {
          const items = next[event.vehicleId] || [];
          next[event.vehicleId] = [...items, event]
            .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
            .slice(0, 20);
        });

        return next;
      });
    },
    onEventNew: (event) => {
      setEventsByVehicle((previous) => {
        const items = previous[event.vehicleId] || [];
        return {
          ...previous,
          [event.vehicleId]: [event, ...items]
            .filter((item, index, array) => index === array.findIndex((x) => x.id === item.id))
            .slice(0, 20),
        };
      });

      if (event.severity === 'CRITICAL') {
        const vehicle = liveVehicles[event.vehicleId];
        toast.custom(
          () => (
            <div className="rounded-lg border border-red-200 bg-white px-3 py-2 shadow-lg">
              <p className="text-sm font-semibold text-red-700">
                {vehicle?.driverName || 'Неизвестный водитель'} · {formatEventType(event.type)}
              </p>
              <div className="mt-1">
                <SeverityBadge severity={event.severity} />
              </div>
            </div>
          ),
          { duration: 5000 },
        );
      }
    },
  });

  const markers = useMemo(
    () => Object.values(liveVehicles).filter((vehicle) => vehicle.lat !== null && vehicle.lng !== null),
    [liveVehicles],
  );

  if (isLoading) {
    return (
      <Card className="space-y-4 p-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-[520px] w-full" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="space-y-2 p-5">
        <CardTitle>Не удалось загрузить данные карты</CardTitle>
        <CardDescription>Не получилось получить список машин с backend API.</CardDescription>
      </Card>
    );
  }

  if (!vehicles.length) {
    return (
      <Card className="space-y-2 p-5">
        <CardTitle>Пока нет машин</CardTitle>
        <CardDescription>Запустите симулятор, чтобы увидеть маркеры на карте в реальном времени.</CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-1">
        <CardTitle>Живая карта автопарка</CardTitle>
        <CardDescription>
          Поток GPS в реальном времени, snapshot при reconnect и история событий за последний час.
        </CardDescription>
      </Card>

      <Card className="h-[74vh] min-h-[460px] overflow-hidden p-2 md:h-[78vh]">
        <MapContainer center={center} zoom={12} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {markers.map((vehicle) => (
            <Marker
              key={vehicle.id}
              position={[vehicle.lat as number, vehicle.lng as number]}
              icon={onlineIcon(vehicle.isOnline)}
            >
              <Popup>
                <div className="min-w-[220px] space-y-2 text-sm">
                  <div>
                    <p className="font-semibold">{vehicle.driverName}</p>
                    <p className="text-xs text-slate-500">{vehicle.licensePlate}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p>Скорость: {vehicle.speed} км/ч</p>
                    <p>Курс: {vehicle.heading}</p>
                    <p className="col-span-2">
                      Последнее обновление:{' '}
                      {vehicle.timestamp ? formatDateTime(vehicle.timestamp) : 'Нет данных'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase text-slate-500">Последние события</p>
                    {(eventsByVehicle[vehicle.id] || []).slice(0, 3).map((event) => (
                      <div
                        key={`${vehicle.id}-${event.id}`}
                        className="flex items-center justify-between rounded-md bg-slate-100 px-2 py-1 text-xs"
                      >
                        <span>{formatEventType(event.type)}</span>
                        <SeverityBadge severity={event.severity} />
                      </div>
                    ))}
                    {!(eventsByVehicle[vehicle.id] || []).length && (
                      <p className="text-xs text-slate-500">Нет недавних событий</p>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </Card>
    </div>
  );
}
