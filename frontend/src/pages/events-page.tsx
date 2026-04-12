import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { useFleetSocket } from '@/hooks/use-fleet-socket';
import { API_BASE_URL, api } from '@/lib/api';
import { formatDateTime } from '@/lib/date';
import {
  EventType,
  EventsListResponse,
  FleetEvent,
  Severity,
  Vehicle,
} from '@/lib/types';
import { SeverityBadge } from '@/components/severity-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type EventsItem = EventsListResponse['items'][number];

interface EventsFilters {
  vehicleId: string;
  type: '' | EventType;
  severity: '' | Severity;
  dateFrom: string;
  dateTo: string;
  search: string;
}

const EVENT_TYPES: EventType[] = [
  'DROWSINESS',
  'SPEEDING',
  'HARSH_BRAKING',
  'COLLISION_WARNING',
];

const SEVERITIES: Severity[] = ['LOW', 'MEDIUM', 'CRITICAL'];

function formatEventType(type: EventType) {
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

function formatSeverity(severity: Severity) {
  switch (severity) {
    case 'LOW':
      return 'Низкая';
    case 'MEDIUM':
      return 'Средняя';
    case 'CRITICAL':
      return 'Критическая';
    default:
      return severity;
  }
}

function toIsoOrUndefined(value: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function buildQueryParams(filters: EventsFilters, page: number) {
  return {
    page,
    limit: 20,
    vehicleId: filters.vehicleId || undefined,
    type: filters.type || undefined,
    severity: filters.severity || undefined,
    dateFrom: toIsoOrUndefined(filters.dateFrom),
    dateTo: toIsoOrUndefined(filters.dateTo),
    search: filters.search || undefined,
  };
}

function normalizeLiveEvent(event: FleetEvent, vehicles: Vehicle[]): EventsItem {
  const vehicle = vehicles.find((item) => item.id === event.vehicleId);

  return {
    ...event,
    vehicle: {
      id: vehicle?.id || event.vehicleId,
      deviceId: vehicle?.deviceId || 'unknown',
      driverName: vehicle?.driverName || 'Неизвестный водитель',
      licensePlate: vehicle?.licensePlate || 'неизвестно',
    },
  };
}

function matchesFilters(event: EventsItem, filters: EventsFilters) {
  if (filters.vehicleId && event.vehicleId !== filters.vehicleId) {
    return false;
  }

  if (filters.type && event.type !== filters.type) {
    return false;
  }

  if (filters.severity && event.severity !== filters.severity) {
    return false;
  }

  const timestamp = Date.parse(event.timestamp);
  if (filters.dateFrom && timestamp < Date.parse(filters.dateFrom)) {
    return false;
  }
  if (filters.dateTo && timestamp > Date.parse(filters.dateTo)) {
    return false;
  }

  if (filters.search) {
    const value = filters.search.toLowerCase();
    const haystack = `${event.vehicle.driverName} ${event.vehicle.licensePlate}`.toLowerCase();
    if (!haystack.includes(value)) {
      return false;
    }
  }

  return true;
}

export function EventsPage() {
  const dateFromRef = useRef<HTMLInputElement>(null);
  const dateToRef = useRef<HTMLInputElement>(null);

  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) {
      return;
    }

    input.focus();
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === 'function') {
      pickerInput.showPicker();
      return;
    }

    input.click();
  };

  const [filters, setFilters] = useState<EventsFilters>({
    vehicleId: '',
    type: '',
    severity: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [liveItems, setLiveItems] = useState<EventsItem[]>([]);

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-select'],
    queryFn: async () => {
      const response = await api.get<Vehicle[]>('/vehicles');
      return response.data;
    },
  });

  const eventsQuery = useQuery({
    queryKey: ['events', filters, page],
    queryFn: async () => {
      const response = await api.get<EventsListResponse>('/events', {
        params: buildQueryParams(filters, page),
      });
      return response.data;
    },
  });

  useEffect(() => {
    setLiveItems([]);
  }, [filters, page]);

  useFleetSocket({
    onEventNew: (event) => {
      if (page !== 1) {
        return;
      }

      const normalized = normalizeLiveEvent(event, vehicles);
      if (!matchesFilters(normalized, filters)) {
        return;
      }

      setLiveItems((previous) => {
        const existingIndex = previous.findIndex((item) => item.id === normalized.id);
        if (existingIndex >= 0) {
          const next = [...previous];
          next[existingIndex] = {
            ...next[existingIndex],
            ...normalized,
          };
          return next;
        }

        return [normalized, ...previous].slice(0, 20);
      });
    },
  });

  const items = useMemo(() => {
    const baseItems = eventsQuery.data?.items || [];

    if (page !== 1 || liveItems.length === 0) {
      return baseItems;
    }

    const map = new Map<string, EventsItem>();
    liveItems.forEach((item) => {
      map.set(item.id, item);
    });
    baseItems.forEach((item) => {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    });

    return Array.from(map.values()).slice(0, 20);
  }, [eventsQuery.data?.items, liveItems, page]);

  const totalPages = eventsQuery.data?.totalPages || 1;

  const updateFilter = <K extends keyof EventsFilters>(key: K, value: EventsFilters[K]) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
    setPage(1);
  };

  const exportCsv = () => {
    const params = new URLSearchParams();
    const queryParams = buildQueryParams(filters, 1);

    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        params.set(key, `${value}`);
      }
    });

    window.open(`${API_BASE_URL}/api/events/export/csv?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-1">
        <CardTitle>Журнал событий</CardTitle>
        <CardDescription>
          Фильтрация, поиск, экспорт CSV и получение новых событий в реальном времени.
        </CardDescription>
      </Card>

      <Card className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <Select
            value={filters.vehicleId || 'ALL'}
            onValueChange={(value) => updateFilter('vehicleId', value === 'ALL' ? '' : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Все машины" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Все машины</SelectItem>
              {vehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.driverName} ({vehicle.licensePlate})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.type || 'ALL'}
            onValueChange={(value) => updateFilter('type', value === 'ALL' ? '' : value as EventType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Все типы событий" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Все типы событий</SelectItem>
              {EVENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {formatEventType(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.severity || 'ALL'}
            onValueChange={(value) => updateFilter('severity', value === 'ALL' ? '' : value as Severity)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Все уровни" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Все уровни</SelectItem>
              {SEVERITIES.map((severity) => (
                <SelectItem key={severity} value={severity}>
                  {formatSeverity(severity)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Input
              ref={dateFromRef}
              type="datetime-local"
              lang="ru-RU"
              value={filters.dateFrom}
              onChange={(event) => updateFilter('dateFrom', event.target.value)}
              placeholder="Дата от"
              className="pr-9 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-0"
            />
            <button
              type="button"
              aria-label="Открыть календарь (дата от)"
              onClick={() => openDatePicker(dateFromRef.current)}
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
          <div className="relative">
            <Input
              ref={dateToRef}
              type="datetime-local"
              lang="ru-RU"
              value={filters.dateTo}
              onChange={(event) => updateFilter('dateTo', event.target.value)}
              placeholder="Дата до"
              className="pr-9 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-0"
            />
            <button
              type="button"
              aria-label="Открыть календарь (дата до)"
              onClick={() => openDatePicker(dateToRef.current)}
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
          <Input
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder="Водитель или номер"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Всего: {eventsQuery.data?.total ?? 0} событий
          </p>
          <Button variant="outline" onClick={exportCsv}>
            Экспорт CSV
          </Button>
        </div>

        {eventsQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Время</TableHead>
                  <TableHead>Машина</TableHead>
                  <TableHead>Водитель</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Уровень</TableHead>
                  <TableHead>Координаты</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatDateTime(item.timestamp)}</TableCell>
                    <TableCell>{item.vehicle.licensePlate}</TableCell>
                    <TableCell>{item.vehicle.driverName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{formatEventType(item.type)}</span>
                        {item.groupCount > 1 && <Badge variant="outline">x{item.groupCount}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={item.severity} />
                    </TableCell>
                    <TableCell>
                      {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            По выбранным фильтрам события не найдены.
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
          >
            Назад
          </Button>
          <p className="min-w-24 text-center text-sm text-muted-foreground">
            Страница {page} / {totalPages}
          </p>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
          >
            Вперед
          </Button>
        </div>
      </Card>
    </div>
  );
}
