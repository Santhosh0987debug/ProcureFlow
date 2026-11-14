import {
  ApprovalDecision,
  ApprovalStepStatus,
  DeliveryStatus,
  PurchaseOrderStatus,
  RequestStatus,
} from '@procureflow/shared';
import type { ApprovalCycleStatus } from '@procureflow/shared';
import { cn } from '../../lib/cn';

export type ProcurementStatus =
  | RequestStatus
  | ApprovalDecision
  | ApprovalCycleStatus
  | ApprovalStepStatus
  | PurchaseOrderStatus
  | DeliveryStatus;

interface StatusDefinition {
  label: string;
  tone: string;
  dot: string;
}

const statusDefinitions: Record<ProcurementStatus, StatusDefinition> = {
  [RequestStatus.Draft]: {
    label: 'Draft',
    tone: 'bg-[#f2efea] text-[#6f6258]',
    dot: 'bg-taupe',
  },
  [RequestStatus.Submitted]: {
    label: 'Submitted',
    tone: 'bg-[#f1ece6] text-[#6a5b50]',
    dot: 'bg-espresso/40',
  },
  [RequestStatus.PendingApproval]: {
    label: 'Pending approval',
    tone: 'bg-[#f4eddf] text-[#6b5430]',
    dot: 'bg-ochre',
  },
  [RequestStatus.ChangesRequested]: {
    label: 'Changes requested',
    tone: 'bg-[#f5ebdd] text-[#7a5a35]',
    dot: 'bg-ochre',
  },
  [RequestStatus.Approved]: {
    label: 'Approved',
    tone: 'bg-[#edefe7] text-[#4f5b40]',
    dot: 'bg-sage',
  },
  [RequestStatus.Rejected]: {
    label: 'Rejected',
    tone: 'bg-[#f5e7e2] text-[#8a4a3b]',
    dot: 'bg-clay',
  },
  [RequestStatus.Cancelled]: {
    label: 'Cancelled',
    tone: 'bg-[#f1eeea] text-[#7a6d62]',
    dot: 'bg-taupe',
  },
  [ApprovalDecision.Pending]: {
    label: 'Pending',
    tone: 'bg-[#f4eddf] text-[#6b5430]',
    dot: 'bg-ochre',
  },
  [ApprovalStepStatus.Skipped]: {
    label: 'Skipped',
    tone: 'bg-[#f1eeea] text-[#7a6d62]',
    dot: 'bg-taupe',
  },
  [PurchaseOrderStatus.Issued]: {
    label: 'Issued',
    tone: 'bg-[#f1ece6] text-[#6a5b50]',
    dot: 'bg-taupe',
  },
  [PurchaseOrderStatus.Acknowledged]: {
    label: 'Acknowledged',
    tone: 'bg-[#efeae2] text-[#63564b]',
    dot: 'bg-espresso/40',
  },
  [PurchaseOrderStatus.PartiallyDelivered]: {
    label: 'Partially delivered',
    tone: 'bg-[#f5ebdd] text-[#7a5a35]',
    dot: 'bg-ochre',
  },
  [PurchaseOrderStatus.Delivered]: {
    label: 'Delivered',
    tone: 'bg-[#eaede5] text-[#4e5a45]',
    dot: 'bg-sage',
  },
  [DeliveryStatus.Scheduled]: {
    label: 'Scheduled',
    tone: 'bg-[#f2efea] text-[#6f6258]',
    dot: 'bg-taupe',
  },
  [DeliveryStatus.InTransit]: {
    label: 'In transit',
    tone: 'bg-[#f1ece6] text-[#6a5b50]',
    dot: 'bg-taupe',
  },
  [DeliveryStatus.Delayed]: {
    label: 'Delayed',
    tone: 'bg-[#f5e7e2] text-[#8a4a3b]',
    dot: 'bg-clay',
  },
};

interface StatusBadgeProps {
  status: ProcurementStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const definition = statusDefinitions[status] ?? {
    label: status,
    tone: 'bg-parchment text-stone',
    dot: 'bg-taupe',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium leading-none',
        definition.tone,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', definition.dot)} aria-hidden="true" />
      {definition.label}
    </span>
  );
}
