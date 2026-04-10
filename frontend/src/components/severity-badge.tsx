import { Severity } from '@/lib/types';
import { Badge } from './ui/badge';

export function SeverityBadge({ severity }: { severity: Severity }) {
  if (severity === 'LOW') {
    return <Badge variant="slate">LOW</Badge>;
  }

  if (severity === 'MEDIUM') {
    return <Badge variant="yellow">MEDIUM</Badge>;
  }

  return <Badge variant="red">CRITICAL</Badge>;
}
