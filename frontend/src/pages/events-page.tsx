import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Select } from '@/components/ui/select';
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
      driverName: vehicle?.driverName || 'Unknown driver',
      licensePlate: vehicle?.licensePlate || 'unknown',
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
        <CardTitle>Events Journal</CardTitle>
        <CardDescription>
          Filter, search, export CSV, and receive new events in realtime.
        </CardDescription>
      </Card>

      <Card className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <Select
            value={filters.vehicleId}
            onChange={(event) => updateFilter('vehicleId', event.target.value)}
          >
            <option value="">All vehicles</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.driverName} ({vehicle.licensePlate})
              </option>
            ))}
          </Select>

          <Select value={filters.type} onChange={(event) => updateFilter('type', event.target.value as '' | EventType)}>
            <option value="">All event types</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>

          <Select
            value={filters.severity}
            onChange={(event) => updateFilter('severity', event.target.value as '' | Severity)}
          >
            <option value="">All severities</option>
            {SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </Select>

          <Input
            type="datetime-local"
            value={filters.dateFrom}
            onChange={(event) => updateFilter('dateFrom', event.target.value)}
            placeholder="Date from"
          />
          <Input
            type="datetime-local"
            value={filters.dateTo}
            onChange={(event) => updateFilter('dateTo', event.target.value)}
            placeholder="Date to"
          />
          <Input
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder="Driver or plate"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Total: {eventsQuery.data?.total ?? 0} events
          </p>
          <Button variant="outline" onClick={exportCsv}>
            Export CSV
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
                  <TableHead>Time</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Coordinates</TableHead>
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
                        <span>{item.type}</span>
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
            No events found for selected filters.
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
          >
            Previous
          </Button>
          <p className="min-w-24 text-center text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </p>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
          >
            Next
          </Button>
        </div>
      </Card>
    </div>
  );
}
