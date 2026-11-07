import { BadgeCheck, BarChart3, ClipboardList, Plus, ShoppingBag, Wallet } from 'lucide-react';
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

const kpiMetrics: KpiMetric[] = [
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
  },
  {
    id: 'active-requests',
    label: 'Active requests',
    value: String(dashboardKpis.activeRequests),
    helper: `${dashboardSupporting.requestsAwaitingSourcing} awaiting sourcing`,
    trend: '+12 this month',
    icon: ClipboardList,
    href: '/purchase-requests',
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
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        eyebrow={formatLongDate(new Date())}
        title="Procurement overview"
        description="A considered view of spend, approvals and delivery across your supply base."
        actions={
          <>
            <ButtonLink to="/reports" variant="secondary" icon={BarChart3}>
              View reports
            </ButtonLink>
            <ButtonLink to="/purchase-requests" variant="primary" icon={Plus}>
              New request
            </ButtonLink>
          </>
        }
      />

      <section
        aria-label="Key procurement metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5"
      >
        {kpiMetrics.map((metric) => (
          <KpiCard key={metric.id} metric={metric} />
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:gap-5">
        <SpendingChart points={spending} />
        <ActivityTimeline events={activity} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
        <ApprovalsTable
          approvals={pendingApprovals}
          total={dashboardKpis.pendingApprovals}
          dueToday={dashboardSupporting.approvalsDueToday}
        />
        <PurchaseOrdersTable
          orders={recentPurchaseOrders}
          total={dashboardKpis.activePurchaseOrders}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[9.5px] text-taupe">
        <span>Demo workspace · Amounts shown in USD</span>
        <span>ProcureFlow Phase 1 · Last updated just now</span>
      </div>
    </div>
  );
}
