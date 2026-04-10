import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export function EventsPage() {
  return (
    <Card className="space-y-2 p-5">
      <CardTitle>Events Journal</CardTitle>
      <CardDescription>
        This page will include filters, search, realtime updates, and CSV export.
      </CardDescription>
    </Card>
  );
}
