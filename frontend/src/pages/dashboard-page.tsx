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
        <CardTitle>Failed to load dashboard</CardTitle>
        <CardDescription>Unable to gather analytics from backend API.</CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-1">
        <CardTitle>Fleet Dashboard</CardTitle>
        <CardDescription>Auto-refreshing analytics every 30 seconds.</CardDescription>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Online Vehicles" value={data.onlineVehicles} note="Updated from live Redis state" />
        <StatCard title="Offline Vehicles" value={data.offlineVehicles} note="No GPS updates in recent window" />
        <StatCard title="Events / Hour" value={data.eventsLastHour} note="Last 60 minutes" />
        <StatCard title="Events / Day" value={data.eventsLastDay} note="Last 24 hours" />
      </div>

      <Card className="space-y-3">
        <CardTitle>Top 5 Vehicles by Event Count</CardTitle>
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
              Not enough event data yet.
            </div>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <CardTitle>Critical Events (24h)</CardTitle>
        {data.criticalEvents.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.criticalEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{formatDateTime(event.timestamp)}</TableCell>
                    <TableCell>{event.vehicle.driverName}</TableCell>
                    <TableCell>{event.vehicle.licensePlate}</TableCell>
                    <TableCell>{event.type}</TableCell>
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
            No critical events in the last 24 hours.
          </div>
        )}
      </Card>
    </div>
  );
}
