import { ActivityType, ApprovalDecision, Currency, PurchaseOrderStatus } from '@procureflow/shared';
import type {
  ActivityEvent,
  ApprovalSummary,
  DashboardKpis,
  Money,
  PurchaseOrderSummary,
  SpendingPoint,
} from '@procureflow/shared';
import { daysAgo, daysFromNow, hoursAgo, minutesAgo } from './time';

const usd = (amount: number): Money => ({ amount, currency: Currency.USD });

const spendingAmounts = [
  186_000, 214_000, 178_000, 232_000, 251_000, 208_000, 274_000, 238_000, 296_000, 312_000, 268_000,
  341_000,
];

const currentDate = new Date();

export const spending: SpendingPoint[] = spendingAmounts.map((amount, index) => {
  const date = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() - (spendingAmounts.length - 1 - index),
    1,
  );

  return {
    period: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date),
    amount,
  };
});

const totalSpend = spending.reduce((total, point) => total + point.amount, 0);

export const dashboardKpis: DashboardKpis = {
  totalSpend: usd(totalSpend),
  activeRequests: 148,
  pendingApprovals: 12,
  activePurchaseOrders: 36,
};

export const dashboardSupporting = {
  requestsAwaitingSourcing: 34,
  approvalsDueToday: 4,
  committedPurchaseOrderSpend: usd(842_000),
};

export const pendingApprovals: ApprovalSummary[] = [
  {
    id: 'approval-294',
    requestId: 'request-294',
    requestReference: 'PR-2026-0294',
    title: 'Q4 laptop refresh for design team',
    requester: { id: 'person-elena', name: 'Elena Marsh', department: 'Design' },
    department: 'Design',
    amount: usd(48_600),
    status: ApprovalDecision.Pending,
    submittedAt: minutesAgo(52),
  },
  {
    id: 'approval-292',
    requestId: 'request-292',
    requestReference: 'PR-2026-0292',
    title: 'Annual security audit services',
    requester: { id: 'person-marcus', name: 'Marcus Webb', department: 'IT' },
    department: 'IT',
    amount: usd(32_000),
    status: ApprovalDecision.Pending,
    submittedAt: minutesAgo(118),
  },
  {
    id: 'approval-289',
    requestId: 'request-289',
    requestReference: 'PR-2026-0289',
    title: 'Warehouse racking expansion',
    requester: { id: 'person-priya', name: 'Priya Nair', department: 'Operations' },
    department: 'Operations',
    amount: usd(76_450),
    status: ApprovalDecision.Pending,
    submittedAt: hoursAgo(5),
  },
  {
    id: 'approval-286',
    requestId: 'request-286',
    requestReference: 'PR-2026-0286',
    title: 'Regional media production',
    requester: { id: 'person-daniel', name: 'Daniel Okafor', department: 'Marketing' },
    department: 'Marketing',
    amount: usd(24_800),
    status: ApprovalDecision.Pending,
    submittedAt: daysAgo(1),
  },
  {
    id: 'approval-284',
    requestId: 'request-284',
    requestReference: 'PR-2026-0284',
    title: 'Executive travel program renewal',
    requester: { id: 'person-sofia', name: 'Sofia Lindqvist', department: 'People' },
    department: 'People',
    amount: usd(18_200),
    status: ApprovalDecision.Pending,
    submittedAt: daysAgo(1),
  },
];

export const recentPurchaseOrders: PurchaseOrderSummary[] = [
  {
    id: 'po-148',
    reference: 'PO-2026-0148',
    vendorName: 'Meridian Office Group',
    amount: usd(62_400),
    status: PurchaseOrderStatus.Issued,
    issuedAt: minutesAgo(24),
    expectedDelivery: daysFromNow(7),
  },
  {
    id: 'po-147',
    reference: 'PO-2026-0147',
    vendorName: 'Northwind Systems',
    amount: usd(118_900),
    status: PurchaseOrderStatus.Acknowledged,
    issuedAt: hoursAgo(4),
    expectedDelivery: daysFromNow(11),
  },
  {
    id: 'po-145',
    reference: 'PO-2026-0145',
    vendorName: 'Aperture Facilities',
    amount: usd(41_750),
    status: PurchaseOrderStatus.PartiallyDelivered,
    issuedAt: daysAgo(2),
    expectedDelivery: daysFromNow(3),
  },
  {
    id: 'po-142',
    reference: 'PO-2026-0142',
    vendorName: 'Halcyon Logistics',
    amount: usd(89_200),
    status: PurchaseOrderStatus.Delivered,
    issuedAt: daysAgo(9),
    expectedDelivery: daysAgo(2),
  },
  {
    id: 'po-140',
    reference: 'PO-2026-0140',
    vendorName: 'Foster & Grey',
    amount: usd(27_600),
    status: PurchaseOrderStatus.Issued,
    issuedAt: daysAgo(3),
    expectedDelivery: daysFromNow(14),
  },
];

export const activity: ActivityEvent[] = [
  {
    id: 'activity-1',
    type: ActivityType.PurchaseOrderIssued,
    title: 'Purchase order issued',
    description: 'PO-2026-0148 sent to Meridian Office Group for workspace furniture.',
    actor: 'Alex Morgan',
    occurredAt: minutesAgo(24),
    entityReference: 'PO-2026-0148',
  },
  {
    id: 'activity-2',
    type: ActivityType.ApprovalGranted,
    title: 'Approval granted',
    description: 'PR-2026-0291 cleared the finance review threshold.',
    actor: 'Naomi Chen',
    occurredAt: minutesAgo(78),
    entityReference: 'PR-2026-0291',
  },
  {
    id: 'activity-3',
    type: ActivityType.VendorOnboarded,
    title: 'Vendor onboarded',
    description: 'Vantage Analytics joined the approved professional services panel.',
    actor: 'Alex Morgan',
    occurredAt: hoursAgo(3),
    entityReference: 'VEN-0042',
  },
  {
    id: 'activity-4',
    type: ActivityType.DeliveryReceived,
    title: 'Delivery received',
    description: 'PO-2026-0139 was received in full by the central warehouse.',
    actor: 'Priya Nair',
    occurredAt: daysAgo(1),
    entityReference: 'PO-2026-0139',
  },
  {
    id: 'activity-5',
    type: ActivityType.RequestSubmitted,
    title: 'New request submitted',
    description: 'Customer research panel intake submitted for marketing review.',
    actor: 'Daniel Okafor',
    occurredAt: daysAgo(2),
    entityReference: 'PR-2026-0287',
  },
];
