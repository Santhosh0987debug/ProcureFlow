import type { Priority } from '@procureflow/shared';
import { PRIORITY_LABELS, PRIORITY_STYLES } from '../../data/request-options';
import { cn } from '../../lib/cn';

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const style = PRIORITY_STYLES[priority];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium leading-none',
        style.tone,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} aria-hidden="true" />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
