import type { ApiSuccessResponse } from './api.js';
import type { ApprovalCycleSummary } from './approvals.js';
import type { PaginatedResult } from './members.js';
import type { Currency, Priority, ProcurementCategory, RequestStatus } from './procurement.js';

/**
 * Phase 4 purchase request contracts.
 *
 * Monetary and quantity values cross the API boundary as fixed-point strings so
 * the server can keep every calculation in Prisma Decimal precision. Client
 * supplied totals are never part of a write payload.
 */
export interface PurchaseRequestItemInput {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  category?: ProcurementCategory | null;
  notes?: string | null;
}

export interface PurchaseRequestWriteRequest {
  title: string;
  description: string;
  department?: string | null;
  category: ProcurementCategory;
  priority: Priority;
  currency: Currency;
  neededBy: string;
  notes?: string | null;
  items: PurchaseRequestItemInput[];
}

export type CreatePurchaseRequestRequest = PurchaseRequestWriteRequest;
export type UpdatePurchaseRequestRequest = PurchaseRequestWriteRequest;

export interface PurchaseRequestRequesterSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
}

export interface PurchaseRequestItemRecord {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  lineTotal: string;
  category: ProcurementCategory | null;
  notes: string | null;
}

export interface PurchaseRequestActions {
  canEdit: boolean;
  canDelete: boolean;
  canSubmit: boolean;
}

export interface PurchaseRequestListSummary {
  id: string;
  requestNumber: string;
  title: string;
  status: RequestStatus;
  priority: Priority;
  category: ProcurementCategory;
  currency: Currency;
  totalAmount: string;
  department: string | null;
  neededBy: string | null;
  requester: PurchaseRequestRequesterSummary;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

export interface PurchaseRequestActivityEntry {
  id: string;
  action: string;
  summary: string | null;
  actor: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  occurredAt: string;
}

export interface PurchaseRequestDetail extends PurchaseRequestListSummary {
  description: string;
  notes: string | null;
  decidedAt: string | null;
  items: PurchaseRequestItemRecord[];
  activity: PurchaseRequestActivityEntry[];
  actions: PurchaseRequestActions;
  approval: ApprovalCycleSummary | null;
  approvalHistory: ApprovalCycleSummary[];
}

export interface PurchaseRequestMetrics {
  total: number;
  draft: number;
  pendingApproval: number;
  changesRequested: number;
  approved: number;
  totalValue: string;
}

export interface PurchaseRequestListResult extends PaginatedResult<PurchaseRequestListSummary> {
  summary: PurchaseRequestMetrics;
}

export interface ListPurchaseRequestsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: RequestStatus;
  requesterId?: string;
  category?: ProcurementCategory;
  priority?: Priority;
  department?: string;
  from?: string;
  to?: string;
}

export type PurchaseRequestListResponse = ApiSuccessResponse<PurchaseRequestListResult>;
export type PurchaseRequestResponse = ApiSuccessResponse<PurchaseRequestDetail>;
