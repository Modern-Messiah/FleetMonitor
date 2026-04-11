import { Severity } from '@/lib/types';
import { Badge } from './ui/badge';

export function SeverityBadge({ severity }: { severity: Severity }) {
  if (severity === 'LOW') {
    return <Badge variant="slate">Низкий</Badge>;
  }

  if (severity === 'MEDIUM') {
    return <Badge variant="yellow">Средний</Badge>;
  }

  return <Badge variant="red">Критический</Badge>;
}
