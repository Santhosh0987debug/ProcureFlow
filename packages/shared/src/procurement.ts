/**
 * Core procurement domain contracts shared by the API and the web workspace.
 *
 * Phase 1 intentionally contains data contracts and status vocabulary only.
 * Business rules and persistence live in later phases.
 */

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  INR = 'INR',
}

export enum Priority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent',
}

export enum RequestStatus {
  Draft = 'draft',
  PendingApproval = 'pending_approval',
  Approved = 'approved',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}

export enum ApprovalDecision {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum PurchaseOrderStatus {
  Draft = 'draft',
  Issued = 'issued',
  Acknowledged = 'acknowledged',
  PartiallyDelivered = 'partially_delivered',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
}

export enum DeliveryStatus {
  Scheduled = 'scheduled',
  InTransit = 'in_transit',
  Delivered = 'delivered',
  Delayed = 'delayed',
  Cancelled = 'cancelled',
}

export enum VendorStatus {
  Active = 'active',
  Onboarding = 'onboarding',
  Inactive = 'inactive',
  Suspended = 'suspended',
}

export enum ProcurementCategory {
  InformationTechnology = 'information_technology',
  Facilities = 'facilities',
  ProfessionalServices = 'professional_services',
  Marketing = 'marketing',
  Operations = 'operations',
  Logistics = 'logistics',
}

export enum ActivityType {
  RequestSubmitted = 'request_submitted',
  ApprovalGranted = 'approval_granted',
  PurchaseOrderIssued = 'purchase_order_issued',
  DeliveryReceived = 'delivery_received',
  VendorOnboarded = 'vendor_onboarded',
}

export type EntityId = string;
export type IsoDateString = string;

export interface Money {
  amount: number;
  currency: Currency;
}

export interface PersonRef {
  id: EntityId;
  name: string;
  department?: string;
}

export interface VendorSummary {
  id: EntityId;
  name: string;
  code: string;
  category: ProcurementCategory;
  status: VendorStatus;
}

export interface PurchaseRequestSummary {
  id: EntityId;
  reference: string;
  title: string;
  requester: PersonRef;
  department: string;
  amount: Money;
  status: RequestStatus;
  priority: Priority;
  submittedAt: IsoDateString;
  neededBy?: IsoDateString;
}

export interface ApprovalSummary {
  id: EntityId;
  requestId: EntityId;
  requestReference: string;
  title: string;
  requester: PersonRef;
  department: string;
  amount: Money;
  status: ApprovalDecision;
  submittedAt: IsoDateString;
}

export interface PurchaseOrderSummary {
  id: EntityId;
  reference: string;
  vendorName: string;
  amount: Money;
  status: PurchaseOrderStatus;
  issuedAt: IsoDateString;
  expectedDelivery: IsoDateString;
}

export interface QuotationSummary {
  id: EntityId;
  reference: string;
  vendorName: string;
  amount: Money;
  submittedAt: IsoDateString;
  validUntil: IsoDateString;
}

export interface DeliverySummary {
  id: EntityId;
  reference: string;
  purchaseOrderReference: string;
  vendorName: string;
  status: DeliveryStatus;
  expectedAt: IsoDateString;
}

export interface ActivityEvent {
  id: EntityId;
  type: ActivityType;
  title: string;
  description: string;
  actor: string;
  occurredAt: IsoDateString;
  entityReference?: string;
}

export interface SpendingPoint {
  /** ISO month, for example `2026-10`. */
  period: string;
  /** Short display label, for example `Oct`. */
  label: string;
  amount: number;
}

export interface DashboardKpis {
  totalSpend: Money;
  activeRequests: number;
  pendingApprovals: number;
  activePurchaseOrders: number;
}

export interface AuditLogEntry {
  id: EntityId;
  action: string;
  actor: string;
  entityType: string;
  entityReference: string;
  occurredAt: IsoDateString;
  summary: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
