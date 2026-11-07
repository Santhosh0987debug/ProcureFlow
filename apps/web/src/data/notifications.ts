import { BadgeCheck, FileText, Truck, UserRoundPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { hoursAgo, minutesAgo } from './time';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  occurredAt: string;
  href: string;
  unread: boolean;
  icon: LucideIcon;
}

export const initialNotifications: NotificationItem[] = [
  {
    id: 'notification-1',
    title: 'Approval needs your attention',
    description: 'PR-2026-0294 · Q4 laptop refresh',
    occurredAt: minutesAgo(12),
    href: '/approvals',
    unread: true,
    icon: BadgeCheck,
  },
  {
    id: 'notification-2',
    title: 'New request submitted',
    description: 'PR-2026-0292 · Annual security audit',
    occurredAt: minutesAgo(44),
    href: '/purchase-requests',
    unread: true,
    icon: FileText,
  },
  {
    id: 'notification-3',
    title: 'Delivery arriving soon',
    description: 'PO-2026-0145 · Aperture Facilities',
    occurredAt: hoursAgo(2),
    href: '/deliveries',
    unread: true,
    icon: Truck,
  },
  {
    id: 'notification-4',
    title: 'Vendor onboarding complete',
    description: 'Vantage Analytics is now active',
    occurredAt: hoursAgo(6),
    href: '/vendors',
    unread: false,
    icon: UserRoundPlus,
  },
];
