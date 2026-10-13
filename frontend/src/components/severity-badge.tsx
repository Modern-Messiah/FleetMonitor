import { badgeMessage, useI18n } from '@/lib/i18n';
import { Severity } from '@/lib/types';
import { Badge } from './ui/badge';

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { t } = useI18n();
  const label = t(badgeMessage(severity));

  if (severity === 'LOW') {
    return <Badge variant="slate">{label}</Badge>;
  }

  if (severity === 'MEDIUM') {
    return <Badge variant="yellow">{label}</Badge>;
  }

  return <Badge variant="red">{label}</Badge>;
}
