import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import throttle from 'lodash.throttle';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, useMap, ZoomControl } from 'react-leaflet';
import { useFleetSocket } from '@/hooks/use-fleet-socket';
import { api } from '@/lib/api';
import { eventKey, fill, Locale, LocaleSwitch, MessageKey, useI18n } from '@/lib/i18n';
import { FleetEvent, FleetSnapshotItem, GpsUpdate, Vehicle } from '@/lib/types';

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

type FilterKey = 'all' | 'attention' | 'online' | 'offline';

const CENTER: [number, number] = [43.238, 76.945];
const OFFLINE_AFTER_MS = 15_000;
const ATTENTION_WINDOW_MS = 5 * 60 * 1000;

const FILTERS: Array<{ key: FilterKey; label: MessageKey }> = [
  { key: 'all', label: 'filterAll' },
  { key: 'attention', label: 'filterAttention' },
  { key: 'online', label: 'filterOnline' },
  { key: 'offline', label: 'filterOffline' },
];

type Copy = (key: MessageKey) => string;

function eventWord(type: FleetEvent['type'], t: Copy) {
  const key = eventKey(type);
  return key ? t(key) : type;
}

function compass(deg: number, locale: Locale) {
  const dirs =
    locale === 'ru'
      ? ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ']
      : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[index];
}

function clock(iso: string, locale: Locale) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function prefersReduce() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    isOnline: vehicle.isOnline,
    lastSeenMs: seenAt(vehicle.state?.timestamp ?? vehicle.lastSeenAt),
  };
}

function seenAt(value: string | null | undefined) {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function latestEvent(events: FleetEvent[] | undefined) {
  return events && events.length ? events[0] : undefined;
}

function isRecentOffline(vehicle: LiveVehicle, now: number) {
  return !vehicle.isOnline && vehicle.lastSeenMs > 0 && now - vehicle.lastSeenMs <= ATTENTION_WINDOW_MS;
}

function isAttention(vehicle: LiveVehicle, latest: FleetEvent | undefined, now: number) {
  return latest?.severity === 'CRITICAL' || isRecentOffline(vehicle, now);
}

function rankOf(vehicle: LiveVehicle, latest: FleetEvent | undefined, now: number) {
  if (latest?.severity === 'CRITICAL') {
    return 0;
  }
  if (isRecentOffline(vehicle, now)) {
    return 1;
  }
  if (vehicle.isOnline && vehicle.speed > 0) {
    return 2;
  }
  if (vehicle.isOnline) {
    return 3;
  }
  return 4;
}

function statusWord(vehicle: LiveVehicle, latest: FleetEvent | undefined, t: Copy) {
  if (latest?.severity === 'CRITICAL') {
    return t('watchNow');
  }
  if (!vehicle.isOnline) {
    return t('noSignal');
  }
  if (vehicle.speed === 0) {
    return t('standing');
  }
  return t('moving');
}

function eventLine(event: FleetEvent, t: Copy, locale: Locale) {
  const name = event.groupCount > 1 ? `${eventWord(event.type, t)} ×${event.groupCount}` : eventWord(event.type, t);
  const time = clock(event.timestamp, locale);
  return time ? `${name} · ${time}` : name;
}

function offlineLine(vehicle: LiveVehicle, now: number, t: Copy) {
  if (!vehicle.lastSeenMs) {
    return t('noSignal');
  }
  const mins = Math.max(1, Math.round((now - vehicle.lastSeenMs) / 60_000));
  return fill(t('offlineAge'), { mins });
}

function eventIcon(critical: boolean) {
  return L.divIcon({
    className: critical ? 'mark is-crit' : 'mark',
    html: '<span class="mark-ring"><i></i></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function hasPlace(event: FleetEvent | undefined): event is FleetEvent {
  return event != null && Number.isFinite(event.lat) && Number.isFinite(event.lng);
}

function markerIcon(options: {
  critical: boolean;
  offline: boolean;
  selected: boolean;
  heading: number | null;
}) {
  const kind = options.critical ? ' is-crit' : options.offline ? ' is-off' : '';
  const selected = options.selected ? ' is-sel' : '';
  const rotation = options.heading == null ? '' : ` style="transform:rotate(${options.heading}deg)"`;
  const tick = options.heading == null ? '' : '<i class="tick"></i>';
  return L.divIcon({
    className: `pin${kind}${selected}`,
    html: `<span class="pin-rot"${rotation}>${tick}<b class="dot"></b></span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function EventPlace({ event, onLook }: { event: FleetEvent; onLook: () => void }) {
  const { locale, t } = useI18n();
  const label = eventLine(event, t, locale);
  if (!hasPlace(event)) {
    return <span>{label}</span>;
  }
  return (
    <button type="button" className="control event-jump" onClick={onLook} aria-label={t('showPlace')}>
      {label}
    </button>
  );
}

function revealPlate(strip: HTMLElement, id: string, smooth: boolean) {
  const plate = strip.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
  if (!plate) {
    return;
  }
  const pad = 16;
  const stripRect = strip.getBoundingClientRect();
  const plateRect = plate.getBoundingClientRect();
  let delta = 0;
  if (plateRect.left < stripRect.left + pad) {
    delta = plateRect.left - stripRect.left - pad;
  } else if (plateRect.right > stripRect.right - pad) {
    delta = plateRect.right - stripRect.right + pad;
  }
  if (delta === 0) {
    return;
  }
  strip.scrollTo({ left: strip.scrollLeft + delta, behavior: smooth ? 'smooth' : 'auto' });
}

function PanOnSelect({ token, target }: { token: number; target: [number, number] | null }) {
  const map = useMap();
  const seen = useRef(0);

  useEffect(() => {
    if (!target || token === 0 || token === seen.current) {
      return;
    }
    seen.current = token;
    map.panTo(target, { animate: !prefersReduce(), duration: 0.45 });
  }, [map, target, token]);

  return null;
}

function InvalidateSize() {
  const map = useMap();

  useEffect(() => {
    const frame = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(frame);
  }, [map]);

  return null;
}

export function MapPage() {
  const { locale, t } = useI18n();
  const { data: vehicles = [], isLoading, isError } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const response = await api.get<Vehicle[]>('/vehicles');
      if (!Array.isArray(response.data)) {
        throw new Error('Список машин не получен');
      }
      return response.data;
    },
  });

  const [liveVehicles, setLiveVehicles] = useState<Record<string, LiveVehicle>>({});
  const [eventsByVehicle, setEventsByVehicle] = useState<Record<string, FleetEvent[]>>({});
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [glance, setGlance] = useState<'car' | 'event'>('car');
  const [panToken, setPanToken] = useState(0);
  const [dismissed, setDismissed] = useState<Record<string, true>>({});
  const [now, setNow] = useState(() => Date.now());
  const throttledUpdates = useRef<Record<string, { (payload: GpsUpdate): void; cancel(): void }>>({});
  const stripRef = useRef<HTMLDivElement>(null);
  const revealSmooth = useRef(false);
  const userCleared = useRef(false);
  const didAuto = useRef(false);

  useEffect(() => {
    const slots = throttledUpdates.current;
    return () => {
      Object.values(slots).forEach((fn) => fn.cancel());
    };
  }, []);

  useEffect(() => {
    if (!Array.isArray(vehicles) || !vehicles.length) {
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
      const tick = Date.now();
      setNow(tick);
      setLiveVehicles((previous) => {
        let changed = false;
        const next = { ...previous };
        Object.keys(next).forEach((vehicleId) => {
          const vehicle = next[vehicleId];
          if (vehicle.isOnline && tick - vehicle.lastSeenMs > OFFLINE_AFTER_MS) {
            next[vehicleId] = { ...vehicle, isOnline: false };
            changed = true;
          }
        });
        return changed ? next : previous;
      });
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  useFleetSocket({
    onConnected: () => setConnected(true),
    onDisconnected: () => setConnected(false),
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
      if (!Array.isArray(snapshot)) {
        return;
      }
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
      if (!Array.isArray(history)) {
        return;
      }
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
            .filter((item, index, array) => index === array.findIndex((entry) => entry.id === item.id))
            .slice(0, 20),
        };
      });
    },
  });

  const roster = useMemo(() => {
    const map = new Map<string, LiveVehicle>();
    const list = Array.isArray(vehicles) ? vehicles : [];
    list.forEach((vehicle) => {
      map.set(vehicle.id, asLiveVehicle(vehicle));
    });
    Object.values(liveVehicles).forEach((vehicle) => {
      map.set(vehicle.id, vehicle);
    });
    return Array.from(map.values());
  }, [vehicles, liveVehicles]);

  const phase = roster.length > 0 ? 'ready' : isLoading ? 'loading' : isError ? 'error' : 'empty';

  const ordered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return roster
      .filter((vehicle) => {
        const latest = latestEvent(eventsByVehicle[vehicle.id]);
        if (filter === 'attention' && !isAttention(vehicle, latest, now)) {
          return false;
        }
        if (filter === 'online' && !vehicle.isOnline) {
          return false;
        }
        if (filter === 'offline' && vehicle.isOnline) {
          return false;
        }
        if (!needle) {
          return true;
        }
        return `${vehicle.licensePlate} ${vehicle.driverName}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        const latestA = latestEvent(eventsByVehicle[a.id]);
        const latestB = latestEvent(eventsByVehicle[b.id]);
        const rankA = rankOf(a, latestA, now);
        const rankB = rankOf(b, latestB, now);
        if (rankA !== rankB) {
          return rankA - rankB;
        }
        if (rankA === 0) {
          return Date.parse(latestB?.timestamp || '') - Date.parse(latestA?.timestamp || '');
        }
        if (rankA === 1) {
          return b.lastSeenMs - a.lastSeenMs;
        }
        return a.licensePlate.localeCompare(b.licensePlate, 'ru');
      });
  }, [roster, eventsByVehicle, filter, query, now]);

  const visibleKey = ordered.map((vehicle) => vehicle.id).join('|');
  const autoId =
    ordered.find((vehicle) => latestEvent(eventsByVehicle[vehicle.id])?.severity === 'CRITICAL')?.id ??
    null;

  useEffect(() => {
    if (userCleared.current || didAuto.current || selectedId || !autoId) {
      if (selectedId && !didAuto.current) {
        didAuto.current = true;
      }
      return;
    }
    const event = latestEvent(eventsByVehicle[autoId]);
    didAuto.current = true;
    setGlance(hasPlace(event) ? 'event' : 'car');
    setSelectedId(autoId);
    setPanToken((token) => token + 1);
  }, [autoId, selectedId, eventsByVehicle]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    if (!ordered.some((vehicle) => vehicle.id === selectedId)) {
      setSelectedId(null);
    }
  }, [ordered, selectedId]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) {
      return;
    }
    if (!selectedId) {
      strip.scrollLeft = 0;
      return;
    }
    const smooth = revealSmooth.current && !prefersReduce();
    revealSmooth.current = false;
    revealPlate(strip, selectedId, smooth);
  }, [selectedId, visibleKey, panToken]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (event.target instanceof HTMLInputElement && event.target.value) {
        return;
      }
      userCleared.current = true;
      setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const choose = (id: string) => {
    revealSmooth.current = true;
    setGlance('car');
    setSelectedId(id);
    setPanToken((token) => token + 1);
  };

  const selected = roster.find((vehicle) => vehicle.id === selectedId) ?? null;
  const selectedEvent = selected ? latestEvent(eventsByVehicle[selected.id]) : undefined;
  const eventHere: [number, number] | null = hasPlace(selectedEvent)
    ? [selectedEvent.lat, selectedEvent.lng]
    : null;
  const carHere: [number, number] | null =
    selected && selected.lat != null && selected.lng != null ? [selected.lat, selected.lng] : null;
  const panTarget = glance === 'event' && eventHere ? eventHere : carHere;

  const lookAtEvent = () => {
    if (!eventHere) {
      return;
    }
    setGlance('event');
    setPanToken((token) => token + 1);
  };

  const trailQuery = useQuery({
    queryKey: ['vehicle-trail', selectedId],
    enabled: Boolean(selectedId),
    refetchInterval: 5000,
    queryFn: async ({ queryKey }) => {
      const id = queryKey[1];
      const response = await api.get<{ gpsPoints?: unknown }>(`/vehicles/${id}`);
      const points = response.data?.gpsPoints;
      if (!Array.isArray(points)) {
        throw new Error('След не получен');
      }
      return points.flatMap((point) => {
        if (!point || typeof point !== 'object') {
          return [];
        }
        const fix = point as { lat?: unknown; lng?: unknown };
        if (typeof fix.lat !== 'number' || typeof fix.lng !== 'number') {
          return [];
        }
        return [[fix.lat, fix.lng] as [number, number]];
      });
    },
  });

  const trail = useMemo(() => {
    const line = trailQuery.data ? [...trailQuery.data].reverse() : [];
    if (selected?.lat != null && selected.lng != null) {
      const last = line[line.length - 1];
      if (!last || last[0] !== selected.lat || last[1] !== selected.lng) {
        line.push([selected.lat, selected.lng]);
      }
    }
    const unique: Array<[number, number]> = [];
    line.forEach((point) => {
      const prev = unique[unique.length - 1];
      if (prev && prev[0] === point[0] && prev[1] === point[1]) {
        return;
      }
      unique.push(point);
    });
    return unique.length >= 2 ? unique : [];
  }, [trailQuery.data, selected]);

  const placeIcon = useMemo(
    () => (selectedEvent ? eventIcon(selectedEvent.severity === 'CRITICAL') : null),
    [selectedEvent],
  );

  const icons = useMemo(() => {
    const next: Record<string, L.DivIcon> = {};
    roster.forEach((vehicle) => {
      const latest = latestEvent(eventsByVehicle[vehicle.id]);
      next[vehicle.id] = markerIcon({
        critical: latest?.severity === 'CRITICAL',
        offline: !vehicle.isOnline,
        selected: vehicle.id === selectedId,
        heading: vehicle.isOnline && Number.isFinite(vehicle.heading) ? vehicle.heading : null,
      });
    });
    return next;
  }, [roster, eventsByVehicle, selectedId]);

  const showCounts = phase === 'ready' || phase === 'empty';
  const onlineCount = showCounts ? roster.filter((vehicle) => vehicle.isOnline).length : null;
  const offlineCount = showCounts ? roster.length - (onlineCount ?? 0) : null;
  const criticalCount = showCounts
    ? roster.filter((vehicle) => latestEvent(eventsByVehicle[vehicle.id])?.severity === 'CRITICAL').length
    : null;

  const captionOpen = phase === 'error' || phase === 'empty' || Boolean(selected);
  const alertEvent =
    selectedEvent && selectedEvent.severity === 'CRITICAL' && !dismissed[selectedEvent.id]
      ? selectedEvent
      : null;

  return (
    <div className="monitor">
      <MapContainer
        center={CENTER}
        zoom={13}
        minZoom={11}
        maxZoom={18}
        zoomControl={false}
        scrollWheelZoom
        className="map-stage"
      >
        <TileLayer
          attribution="Tiles &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          maxZoom={20}
          detectRetina={false}
        />
        <ZoomControl position="topright" />
        <InvalidateSize />
        <PanOnSelect token={panToken} target={panTarget} />
        {trail.length >= 2 && (
          <>
            <Polyline
              positions={trail}
              pathOptions={{ color: '#f4f1ea', weight: 5, opacity: 0.95, interactive: false }}
            />
            <Polyline
              positions={trail}
              pathOptions={{ color: '#0a0a0a', weight: 2, opacity: 0.9, interactive: false }}
            />
          </>
        )}
        {eventHere && placeIcon && (
          <Marker position={eventHere} icon={placeIcon} zIndexOffset={40} keyboard={false} interactive={false} />
        )}
        {ordered.map((vehicle) => {
          if (vehicle.lat == null || vehicle.lng == null) {
            return null;
          }
          const latest = latestEvent(eventsByVehicle[vehicle.id]);
          const critical = latest?.severity === 'CRITICAL';
          const z = (critical ? 400 : vehicle.isOnline ? 200 : 0) + (vehicle.id === selectedId ? 400 : 0);
          return (
            <Marker
              key={vehicle.id}
              position={[vehicle.lat, vehicle.lng]}
              icon={icons[vehicle.id]}
              zIndexOffset={z}
              keyboard={false}
              eventHandlers={{ click: () => choose(vehicle.id) }}
            />
          );
        })}
      </MapContainer>

      <header className="bar">
        <div className="brand">{t('brand')}</div>
        <div className="hair" aria-hidden="true" />
        <p className="counts">
          <span>
            <b>{onlineCount ?? '—'}</b> {t('onlineCount')}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <b>{offlineCount ?? '—'}</b> {t('offlineCount')}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <b>{criticalCount ?? '—'}</b> {t('criticalCount')}
          </span>
        </p>
        <div className="spacer" />
        <input
          className="find"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchLabel')}
        />
        <nav className="filters" aria-label={t('filterLabel')}>
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="control"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
            >
              {t(item.label)}
            </button>
          ))}
        </nav>
        <div className="hair" aria-hidden="true" />
        <nav className="filters links" aria-label={t('sections')}>
          <Link to="/events" className="control">
            {t('journal')}
          </Link>
          <Link to="/dashboard" className="control">
            {t('summary')}
          </Link>
        </nav>
        <div className="hair" aria-hidden="true" />
        <LocaleSwitch />
        <div className="hair" aria-hidden="true" />
        <p className={connected ? 'snap' : 'snap is-down'}>{connected ? t('streamLive') : t('streamDown')}</p>
      </header>

      <div className="caption" hidden={!captionOpen} aria-live="polite">
        {phase === 'error' && (
          <>
            <p className="who">{t('noData')}</p>
            <p className="meta">{t('listFailed')}</p>
          </>
        )}
        {phase === 'empty' && (
          <>
            <p className="who">{t('noVehicles')}</p>
            <p className="meta">{t('startSimulator')}</p>
          </>
        )}
        {phase === 'ready' && selected && (
          <>
            <p className="who">{selected.driverName}</p>
            <p className="platenum">{selected.licensePlate}</p>
            {selected.isOnline ? (
              <p className="meta">
                <span className="num">{fill(t('speed'), { speed: selected.speed })}</span>
                {Number.isFinite(selected.heading) ? ` · ${compass(selected.heading, locale)}` : ''}
              </p>
            ) : (
              <p className="meta">{offlineLine(selected, now, t)}</p>
            )}
            {alertEvent && (
              <p className="alert">
                <EventPlace event={alertEvent} onLook={lookAtEvent} />
                <button
                  type="button"
                  className="control dismiss"
                  onClick={() => setDismissed((previous) => ({ ...previous, [alertEvent.id]: true }))}
                >
                  {t('dismiss')}
                </button>
              </p>
            )}
            {selectedEvent && !alertEvent && (
              <p className="meta">
                <EventPlace event={selectedEvent} onLook={lookAtEvent} />
              </p>
            )}
          </>
        )}
      </div>

      <div className="film">
        <div className="strip" id="strip" ref={stripRef}>
          {phase === 'loading' && <p className="strip-note">{t('loading')}</p>}
          {phase === 'error' && <p className="strip-note">{t('loadVehiclesFailed')}</p>}
          {phase === 'empty' && <p className="strip-note">{t('noVehicles')}</p>}
          {phase === 'ready' && ordered.length === 0 && <p className="strip-note">{t('noFilterMatch')}</p>}
          {phase === 'ready' &&
            ordered.map((vehicle) => {
              const latest = latestEvent(eventsByVehicle[vehicle.id]);
              const hot = latest?.severity === 'CRITICAL';
              return (
                <button
                  key={vehicle.id}
                  type="button"
                  className="plate control"
                  data-id={vehicle.id}
                  aria-pressed={vehicle.id === selectedId}
                  onClick={() => choose(vehicle.id)}
                >
                  <span className="plate-top">
                    <span className="plate-num">{vehicle.licensePlate}</span>
                    {latest && latest.groupCount > 1 ? <span className="times">×{latest.groupCount}</span> : null}
                  </span>
                  <span className="driver">{vehicle.driverName}</span>
                  <span className={hot ? 'status is-hot' : 'status'}>{statusWord(vehicle, latest, t)}</span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
