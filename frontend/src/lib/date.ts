import { format, parseISO } from 'date-fns';

export function formatDateTime(value: string | Date) {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, 'dd.MM.yyyy HH:mm:ss');
}
