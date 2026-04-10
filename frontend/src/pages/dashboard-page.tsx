import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export function DashboardPage() {
  return (
    <Card className="space-y-2 p-5">
      <CardTitle>Dashboard</CardTitle>
      <CardDescription>
        This page will include stats cards, critical events feed, and top vehicles chart.
      </CardDescription>
    </Card>
  );
}
