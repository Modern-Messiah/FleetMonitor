import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/app-shell';
import { DashboardPage } from '@/pages/dashboard-page';
import { EventsPage } from '@/pages/events-page';
import { MapPage } from '@/pages/map-page';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/map" replace />} />
        <Route path="map" element={<MapPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/map" replace />} />
    </Routes>
  );
}
