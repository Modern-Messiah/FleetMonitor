import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SeverityBadge } from '@/components/severity-badge';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/date';
import { EventsListResponse, Vehicle } from '@/lib/types';

interface DashboardData {
  onlineVehicles: number;
  offlineVehicles: number;
  eventsLastHour: number;
  eventsLastDay: number;
  criticalEvents: EventsListResponse['items'];
  topVehicles: Array<{ name: string; count: number }>;
}

function formatEventType(type: EventsListResponse['items'][number]['type']) {
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

async function fetchEventsTotal(dateFromIso: string) {
  const response = await api.get<EventsListResponse>('/events', {
    params: {
      dateFrom: dateFromIso,
      page: 1,
      limit: 1,
    },
  });
  return response.data.total;
}

async function fetchDashboardData(): Promise<DashboardData> {
  const now = Date.now();
  const hourAgoIso = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgoIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [vehiclesResponse, hourTotal, dayTotal, criticalResponse, topResponse] = await Promise.all([
    api.get<Vehicle[]>('/vehicles'),
    fetchEventsTotal(hourAgoIso),
    fetchEventsTotal(dayAgoIso),
    api.get<EventsListResponse>('/events', {
      params: {
        severity: 'CRITICAL',
        dateFrom: dayAgoIso,
        page: 1,
        limit: 20,
      },
    }),
    api.get<EventsListResponse>('/events', {
      params: {
        dateFrom: dayAgoIso,
        page: 1,
        limit: 500,
      },
    }),
  ]);

  const vehicles = vehiclesResponse.data;

  const counts = new Map<string, { name: string; count: number }>();
  topResponse.data.items.forEach((event) => {
    const existing = counts.get(event.vehicleId);
    const nextCount = (existing?.count || 0) + Math.max(event.groupCount || 1, 1);
    counts.set(event.vehicleId, {
      name: event.vehicle.driverName,
      count: nextCount,
    });
  });

  const topVehicles = Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    onlineVehicles: vehicles.filter((vehicle) => vehicle.isOnline).length,
    offlineVehicles: vehicles.filter((vehicle) => !vehicle.isOnline).length,
    eventsLastHour: hourTotal,
    eventsLastDay: dayTotal,
    criticalEvents: criticalResponse.data.items,
    topVehicles,
  };
}

function StatCard({ title, value, note }: { title: string; value: number; note: string }) {
  return (
    <Card className="space-y-2">
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
      <p className="text-3xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </Card>
  );
}

export function DashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    refetchInterval: 30_000,
  });

  const data = dashboardQuery.data;

  const chartData = useMemo(() => data?.topVehicles || [], [data?.topVehicles]);

  if (dashboardQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (dashboardQuery.isError || !data) {
    return (
      <Card className="space-y-2 p-5">
        <CardTitle>Не удалось загрузить дашборд</CardTitle>
        <CardDescription>Не получилось получить аналитику с backend API.</CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-1">
        <CardTitle>Дашборд автопарка</CardTitle>
        <CardDescription>Аналитика автоматически обновляется каждые 30 секунд.</CardDescription>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Онлайн машин" value={data.onlineVehicles} note="Обновляется по живому состоянию из Redis" />
        <StatCard title="Оффлайн машин" value={data.offlineVehicles} note="Нет GPS-обновлений за последнее время" />
        <StatCard title="Событий за час" value={data.eventsLastHour} note="Последние 60 минут" />
        <StatCard title="Событий за день" value={data.eventsLastDay} note="Последние 24 часа" />
      </div>

      <Card className="space-y-3">
        <CardTitle>Топ-5 машин по числу событий</CardTitle>
        <div className="h-[320px] w-full">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis
                  dataKey="name"
                  angle={-18}
                  interval={0}
                  textAnchor="end"
                  tick={{ fontSize: 12 }}
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Пока недостаточно данных по событиям.
            </div>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <CardTitle>Критические события за 24 часа</CardTitle>
        {data.criticalEvents.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Время</TableHead>
                  <TableHead>Водитель</TableHead>
                  <TableHead>Машина</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Уровень</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.criticalEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{formatDateTime(event.timestamp)}</TableCell>
                    <TableCell>{event.vehicle.driverName}</TableCell>
                    <TableCell>{event.vehicle.licensePlate}</TableCell>
                    <TableCell>{formatEventType(event.type)}</TableCell>
                    <TableCell>
                      <SeverityBadge severity={event.severity} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            За последние 24 часа критических событий не было.
          </div>
        )}
      </Card>
    </div>
  );
}
