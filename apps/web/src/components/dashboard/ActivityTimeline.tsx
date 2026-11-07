import { ActivityType } from '@procureflow/shared';
import type { ActivityEvent } from '@procureflow/shared';
import { ArrowUpRight, BadgeCheck, Building2, FilePlus2, ShoppingBag, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { formatRelativeTime } from '../../lib/format';
import { Card } from '../ui/Card';

interface ActivityTimelineProps {
  events: ActivityEvent[];
}

const activityIcons: Record<ActivityType, LucideIcon> = {
  [ActivityType.RequestSubmitted]: FilePlus2,
  [ActivityType.ApprovalGranted]: BadgeCheck,
  [ActivityType.PurchaseOrderIssued]: ShoppingBag,
  [ActivityType.DeliveryReceived]: Truck,
  [ActivityType.VendorOnboarded]: Building2,
};

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-beige/70 px-5 py-5 sm:px-6">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">Activity</h2>
          <p className="mt-1 text-[11px] text-stone">Latest events across your workspace</p>
        </div>
        <Link
          to="/audit-logs"
          className="mt-0.5 inline-flex items-center gap-1 rounded-md text-[10.5px] font-medium text-stone transition-colors hover:text-espresso"
        >
          Audit log
          <ArrowUpRight size={12} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </div>

      <ol className="flex-1 px-5 py-5 sm:px-6">
        {events.map((event, index) => {
          const Icon = activityIcons[event.type];
          const isLast = index === events.length - 1;

          return (
            <li key={event.id} className={cn('relative flex gap-3.5', !isLast && 'pb-5')}>
              {!isLast ? (
                <span
                  className="absolute left-4 top-9 h-[calc(100%-1.25rem)] w-px bg-beige"
                  aria-hidden="true"
                />
              ) : null}
              <span className="relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-beige bg-ivory text-stone">
                <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[12.5px] font-medium leading-5 text-espresso">{event.title}</p>
                  <span className="shrink-0 pt-0.5 text-[9px] text-taupe">
                    {formatRelativeTime(event.occurredAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-5 text-stone">{event.description}</p>
                <p className="mt-1 text-[8.5px] uppercase tracking-[0.09em] text-taupe">
                  {event.actor}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
