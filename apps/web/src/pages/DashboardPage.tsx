import { Permission, ROLE_LABELS } from '@procureflow/shared';
import { BadgeCheck, BarChart3, ClipboardList, Plus, ShoppingBag, Wallet } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { cn } from '../lib/cn';
import {
  activity,
  dashboardKpis,
  dashboardSupporting,
  pendingApprovals,
  recentPurchaseOrders,
  spending,
} from '../data/dashboard';
import { formatCompactCurrency, formatLongDate } from '../lib/format';
import { ActivityTimeline } from '../components/dashboard/ActivityTimeline';
import { ApprovalsTable } from '../components/dashboard/ApprovalsTable';
import { KpiCard } from '../components/dashboard/KpiCard';
import type { KpiMetric } from '../components/dashboard/KpiCard';
import { PurchaseOrdersTable } from '../components/dashboard/PurchaseOrdersTable';
import { SpendingChart } from '../components/dashboard/SpendingChart';
import { ButtonLink } from '../components/ui/ButtonLink';
import { PageHeader } from '../components/ui/PageHeader';

interface DashboardMetric extends KpiMetric {
  permissions: readonly Permission[];
}

const kpiMetrics: DashboardMetric[] = [
  {
    id: 'total-spend',
    label: 'Total spend',
    value: formatCompactCurrency(
      dashboardKpis.totalSpend.amount,
      dashboardKpis.totalSpend.currency,
    ),
    helper: 'Trailing 12 months',
    trend: '+8.2%',
    icon: Wallet,
    href: '/reports',
    permissions: [Permission.ReportsRead],
  },
  {
    id: 'active-requests',
    label: 'Active requests',
    value: String(dashboardKpis.activeRequests),
    helper: `${dashboardSupporting.requestsAwaitingSourcing} awaiting sourcing`,
    trend: '+12 this month',
    icon: ClipboardList,
    href: '/purchase-requests',
    permissions: [Permission.RequestsRead, Permission.RequestsReadOwn],
  },
  {
    id: 'pending-approvals',
    label: 'Pending approvals',
    value: String(dashboardKpis.pendingApprovals),
    helper: 'Across 6 departments',
    trend: `${dashboardSupporting.approvalsDueToday} due today`,
    trendTone: 'attention',
    icon: BadgeCheck,
    href: '/approvals',
    permissions: [Permission.ApprovalsRead],
  },
  {
    id: 'active-orders',
    label: 'Active purchase orders',
    value: String(dashboardKpis.activePurchaseOrders),
    helper: `${formatCompactCurrency(
      dashboardSupporting.committedPurchaseOrderSpend.amount,
      dashboardSupporting.committedPurchaseOrderSpend.currency,
    )} committed`,
    trend: '+6 this month',
    icon: ShoppingBag,
    href: '/purchase-orders',
    permissions: [Permission.PurchaseOrdersRead],
  },
];

export default function DashboardPage() {
  const { activeWorkspace, hasPermission, hasAnyPermission } = useAuth();
  const workspaceName = activeWorkspace?.name ?? 'Demo workspace';
  const canViewReports = hasPermission(Permission.ReportsRead);
  const canCreateRequest = hasPermission(Permission.RequestsCreate);
  const canViewApprovals = hasPermission(Permission.ApprovalsRead);
  const canViewPurchaseOrders = hasPermission(Permission.PurchaseOrdersRead);
  const visibleMetrics = kpiMetrics.filter((metric) => hasAnyPermission(metric.permissions));
  const hasActions = canViewReports || canCreateRequest;

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        eyebrow={formatLongDate(new Date())}
        title="Procurement overview"
        description="A considered view of spend, approvals and delivery across your supply base."
        actions={
          hasActions ? (
            <>
              {canViewReports ? (
                <ButtonLink to="/reports" variant="secondary" icon={BarChart3}>
                  View reports
                </ButtonLink>
              ) : null}
              {canCreateRequest ? (
                <ButtonLink to="/purchase-requests" variant="primary" icon={Plus}>
                  New request
                </ButtonLink>
              ) : null}
            </>
          ) : undefined
        }
      />

      <section
        aria-label="Key procurement metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5"
      >
        {visibleMetrics.map((metric) => (
          <KpiCard key={metric.id} metric={metric} />
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:gap-5">
        <SpendingChart points={spending} />
        <ActivityTimeline events={activity} />
      </div>

      {canViewApprovals || canViewPurchaseOrders ? (
        <div
          className={cn(
            'grid gap-4 xl:gap-5',
            canViewApprovals && canViewPurchaseOrders && 'xl:grid-cols-2',
          )}
        >
          {canViewApprovals ? (
            <ApprovalsTable
              approvals={pendingApprovals}
              total={dashboardKpis.pendingApprovals}
              dueToday={dashboardSupporting.approvalsDueToday}
            />
          ) : null}
          {canViewPurchaseOrders ? (
            <PurchaseOrdersTable
              orders={recentPurchaseOrders}
              total={dashboardKpis.activePurchaseOrders}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[9.5px] text-taupe">
        <span>{workspaceName} · Amounts shown in USD</span>
        <span>
          {activeWorkspace ? ROLE_LABELS[activeWorkspace.role] : 'Workspace member'} · ProcureFlow
          Phase 3
        </span>
      </div>
    </div>
  );
}
