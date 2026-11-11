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
import { Permission } from '@procureflow/shared';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
  keywords?: string[];
  /** The item is visible when the member holds any one of these permissions. */
  permissions?: readonly Permission[];
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
        permissions: [Permission.WorkspaceRead],
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
        permissions: [Permission.RequestsRead, Permission.RequestsReadOwn],
      },
      {
        label: 'Approvals',
        to: '/approvals',
        icon: BadgeCheck,
        badge: 12,
        keywords: ['review', 'pending', 'decision'],
        permissions: [Permission.ApprovalsRead],
      },
      {
        label: 'Vendors',
        to: '/vendors',
        icon: Store,
        keywords: ['suppliers', 'partners', 'directory'],
        permissions: [Permission.VendorsRead],
      },
      {
        label: 'Quotations',
        to: '/quotations',
        icon: FileSpreadsheet,
        keywords: ['quotes', 'bids', 'sourcing'],
        permissions: [Permission.QuotationsRead],
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
        permissions: [Permission.PurchaseOrdersRead],
      },
      {
        label: 'Deliveries',
        to: '/deliveries',
        icon: Truck,
        keywords: ['shipping', 'receiving', 'logistics'],
        permissions: [Permission.DeliveriesRead],
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
        permissions: [Permission.ReportsRead],
      },
      {
        label: 'Audit Logs',
        to: '/audit-logs',
        icon: History,
        keywords: ['history', 'activity', 'compliance'],
        permissions: [Permission.AuditLogsRead],
      },
    ],
  },
];

export const settingsNavItem: NavItem = {
  label: 'Settings',
  to: '/settings',
  icon: Settings,
  keywords: ['preferences', 'workspace', 'account', 'members', 'team', 'permissions'],
  permissions: [Permission.WorkspaceRead],
};

export const navigationItems: NavItem[] = [
  ...navigationSections.flatMap((section) => section.items),
  settingsNavItem,
];

export function canAccessNavItem(
  item: NavItem,
  hasAnyPermission: (permissions: readonly Permission[]) => boolean,
): boolean {
  return !item.permissions || item.permissions.length === 0 || hasAnyPermission(item.permissions);
}

export function filterNavigationSections(
  hasAnyPermission: (permissions: readonly Permission[]) => boolean,
): NavSection[] {
  return navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessNavItem(item, hasAnyPermission)),
    }))
    .filter((section) => section.items.length > 0);
}

export function filterNavigationItems(
  hasAnyPermission: (permissions: readonly Permission[]) => boolean,
): NavItem[] {
  return navigationItems.filter((item) => canAccessNavItem(item, hasAnyPermission));
}

export function getNavItemForPath(pathname: string): NavItem | undefined {
  return navigationItems.find((item) =>
    item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
}
