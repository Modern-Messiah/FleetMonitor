export const EVENT_TYPES = [
  'DROWSINESS',
  'SPEEDING',
  'HARSH_BRAKING',
  'COLLISION_WARNING',
] as const;

export const SEVERITIES = ['LOW', 'MEDIUM', 'CRITICAL'] as const;

export const WEBHOOK_STATUSES = ['PENDING', 'SUCCESS', 'FAILED'] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type WebhookStatus = (typeof WEBHOOK_STATUSES)[number];
