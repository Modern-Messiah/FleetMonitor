import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  FleetEvent,
  FleetSnapshotItem,
  GpsUpdate,
  VehicleStatus,
} from '@/lib/types';
import { WS_BASE_URL } from '@/lib/api';

interface FleetSocketHandlers {
  onGpsUpdate?: (payload: GpsUpdate) => void;
  onEventNew?: (payload: FleetEvent) => void;
  onVehicleStatus?: (payload: VehicleStatus) => void;
  onFleetSnapshot?: (payload: FleetSnapshotItem[]) => void;
  onEventsHistory?: (payload: FleetEvent[]) => void;
  onConnected?: (socket: Socket) => void;
  onDisconnected?: () => void;
}

export function useFleetSocket(handlers: FleetSocketHandlers) {
  const handlersRef = useRef<FleetSocketHandlers>(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const socket = io(`${WS_BASE_URL}/fleet`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      handlersRef.current.onConnected?.(socket);
    });

    socket.on('disconnect', () => {
      handlersRef.current.onDisconnected?.();
    });

    socket.on('gps:update', (payload: GpsUpdate) => {
      handlersRef.current.onGpsUpdate?.(payload);
    });

    socket.on('event:new', (payload: FleetEvent) => {
      handlersRef.current.onEventNew?.(payload);
    });

    socket.on('vehicle:status', (payload: VehicleStatus) => {
      handlersRef.current.onVehicleStatus?.(payload);
    });

    socket.on('fleet:snapshot', (payload: FleetSnapshotItem[]) => {
      handlersRef.current.onFleetSnapshot?.(payload);
    });

    socket.on('events:history', (payload: FleetEvent[]) => {
      handlersRef.current.onEventsHistory?.(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, []);
}
