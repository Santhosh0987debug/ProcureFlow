import {
  BadgeCheck,
  ChartNoAxesColumn,
  FileSpreadsheet,
  FileText,
  History,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Store,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
  keywords?: string[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const navigationSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        to: '/',
        icon: LayoutDashboard,
        end: true,
        keywords: ['home', 'overview', 'summary'],
      },
    ],
  },
  {
    label: 'Procurement',
    items: [
      {
        label: 'Purchase Requests',
        to: '/purchase-requests',
        icon: FileText,
        keywords: ['requests', 'intake', 'requisition', 'buy'],
      },
      {
        label: 'Approvals',
        to: '/approvals',
        icon: BadgeCheck,
        badge: 12,
        keywords: ['review', 'pending', 'decision'],
      },
      {
        label: 'Vendors',
        to: '/vendors',
        icon: Store,
        keywords: ['suppliers', 'partners', 'directory'],
      },
      {
        label: 'Quotations',
        to: '/quotations',
        icon: FileSpreadsheet,
        keywords: ['quotes', 'bids', 'sourcing'],
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        label: 'Purchase Orders',
        to: '/purchase-orders',
        icon: ShoppingCart,
        keywords: ['orders', 'po', 'commitments'],
      },
      {
        label: 'Deliveries',
        to: '/deliveries',
        icon: Truck,
        keywords: ['shipping', 'receiving', 'logistics'],
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        label: 'Reports',
        to: '/reports',
        icon: ChartNoAxesColumn,
        keywords: ['analytics', 'spend', 'performance'],
      },
      {
        label: 'Audit Logs',
        to: '/audit-logs',
        icon: History,
        keywords: ['history', 'activity', 'compliance'],
      },
    ],
  },
];

export const settingsNavItem: NavItem = {
  label: 'Settings',
  to: '/settings',
  icon: Settings,
  keywords: ['preferences', 'workspace', 'account'],
};

export const navigationItems: NavItem[] = [
  ...navigationSections.flatMap((section) => section.items),
  settingsNavItem,
];

export function getNavItemForPath(pathname: string): NavItem | undefined {
  return navigationItems.find((item) =>
    item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
}
