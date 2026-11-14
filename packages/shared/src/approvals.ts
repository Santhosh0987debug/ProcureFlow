import type { ApiSuccessResponse } from './api.js';
import type { WorkspaceRole } from './auth.js';
import type { PaginatedResult } from './members.js';
import type { Currency, Priority } from './procurement.js';
import type { PurchaseRequestDetail } from './requests.js';

/**
 * Phase 5 approval workflow and decision contracts.
 *
 * Approval cycles snapshot the workflow configuration at submission time. These
 * types therefore expose the snapshot (level names, completion rules, assigned
 * approvers and decisions) rather than re-reading mutable workflow settings.
 */

export enum ApprovalCycleStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  ChangesRequested = 'changes_requested',
  Cancelled = 'cancelled',
}

export enum ApprovalStepStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  ChangesRequested = 'changes_requested',
  Cancelled = 'cancelled',
  Skipped = 'skipped',
}

/** How a parallel approval level is considered complete. */
export enum ApprovalLevelRule {
  AllRequired = 'all_required',
  AnyOne = 'any_one',
}

export enum ApproverAssignmentType {
  Member = 'member',
  Role = 'role',
}

export interface ApprovalPersonSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
}

export interface ApprovalWorkflowMemberRecord {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  role: WorkspaceRole;
  status: 'active' | 'suspended';
}

export interface ApprovalWorkflowApproverRecord {
  id: string;
  assignmentType: ApproverAssignmentType;
  role: WorkspaceRole | null;
  member: ApprovalWorkflowMemberRecord | null;
}

export interface ApprovalWorkflowLevelRecord {
  id: string;
  levelOrder: number;
  name: string;
  completionRule: ApprovalLevelRule;
  approvers: ApprovalWorkflowApproverRecord[];
}

export interface ApprovalWorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  currency: Currency;
  minAmount: string | null;
  maxAmount: string | null;
  levelCount: number;
  approverCount: number;
  createdBy: ApprovalPersonSummary;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalWorkflowDetail extends ApprovalWorkflowSummary {
  levels: ApprovalWorkflowLevelRecord[];
}

export interface ApprovalWorkflowPreviewLevel {
  levelOrder: number;
  name: string;
  completionRule: ApprovalLevelRule;
  approvers: ApprovalPersonSummary[];
  warnings: string[];
}

export interface ApprovalWorkflowPreview {
  name: string;
  currency: Currency;
  minAmount: string | null;
  maxAmount: string | null;
  isActive: boolean;
  isDefault: boolean;
  levels: ApprovalWorkflowPreviewLevel[];
  warnings: string[];
  canActivate: boolean;
}

export type ApprovalWorkflowApproverInput =
  | { assignmentType: ApproverAssignmentType.Member; memberId: string }
  | { assignmentType: ApproverAssignmentType.Role; role: WorkspaceRole };

export interface ApprovalWorkflowLevelInput {
  name: string;
  completionRule: ApprovalLevelRule;
  approvers: ApprovalWorkflowApproverInput[];
}

export interface ApprovalWorkflowWriteRequest {
  name: string;
  description?: string | null;
  isDefault: boolean;
  currency: Currency;
  minAmount?: string | null;
  maxAmount?: string | null;
  levels: ApprovalWorkflowLevelInput[];
}

export type CreateApprovalWorkflowRequest = ApprovalWorkflowWriteRequest;
export type UpdateApprovalWorkflowRequest = ApprovalWorkflowWriteRequest;

export type ApprovalWorkflowStatusFilter = 'active' | 'inactive' | 'default';

export interface ListApprovalWorkflowsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ApprovalWorkflowStatusFilter;
}

export type ApprovalWorkflowListResult = PaginatedResult<ApprovalWorkflowSummary>;

export interface ApprovalStepRecord {
  id: string;
  levelOrder: number;
  stepOrder: number;
  name: string;
  assignmentType: ApproverAssignmentType;
  assignedRole: WorkspaceRole | null;
  approver: ApprovalPersonSummary | null;
  status: ApprovalStepStatus;
  decisionNote: string | null;
  decidedAt: string | null;
  decidedBy: ApprovalPersonSummary | null;
  isActive: boolean;
  createdAt: string;
}

export interface ApprovalLevelRecord {
  levelOrder: number;
  name: string;
  completionRule: ApprovalLevelRule;
  status: ApprovalStepStatus;
  steps: ApprovalStepRecord[];
}

export interface ApprovalCycleSummary {
  id: string;
  cycleNumber: number;
  status: ApprovalCycleStatus;
  workflowName: string | null;
  workflowDescription: string | null;
  currentLevel: number;
  levelCount: number;
  requestedAt: string;
  completedAt: string | null;
  requestedBy: ApprovalPersonSummary | null;
  levels: ApprovalLevelRecord[];
}

export interface ApprovalInboxItem {
  approvalId: string;
  cycleNumber: number;
  approvalStatus: ApprovalCycleStatus;
  requestId: string;
  requestNumber: string;
  title: string;
  requester: ApprovalPersonSummary;
  department: string | null;
  amount: string;
  currency: Currency;
  priority: Priority;
  submittedAt: string;
  levelOrder: number;
  levelName: string;
  levelCount: number;
  completionRule: ApprovalLevelRule;
  stepStatus: ApprovalStepStatus;
  assignedAt: string;
  isActive: boolean;
}

export interface ApprovalInboxSummary {
  pending: number;
  approved: number;
  rejected: number;
  changesRequested: number;
}

export interface ApprovalInboxResult extends PaginatedResult<ApprovalInboxItem> {
  summary: ApprovalInboxSummary;
}

export interface ListApprovalsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ApprovalStepStatus;
  priority?: Priority;
  requester?: string;
  requesterId?: string;
  minAmount?: string;
  maxAmount?: string;
  from?: string;
  to?: string;
}

export interface ApprovalDecisionActions {
  canApprove: boolean;
  canReject: boolean;
  canRequestChanges: boolean;
  assignedStepId: string | null;
  blockedReason: string | null;
}

export interface ApprovalDetail extends ApprovalCycleSummary {
  request: PurchaseRequestDetail;
  actions: ApprovalDecisionActions;
  history: ApprovalCycleSummary[];
}

export interface ApprovalHistoryResult {
  items: ApprovalCycleSummary[];
}

export interface ApproveApprovalRequest {
  comment?: string | null;
}

export interface RejectApprovalRequest {
  reason: string;
}

export interface RequestApprovalChangesRequest {
  explanation: string;
}

export type ApprovalWorkflowListResponse = ApiSuccessResponse<ApprovalWorkflowListResult>;
export type ApprovalWorkflowResponse = ApiSuccessResponse<ApprovalWorkflowDetail>;
export type ApprovalInboxResponse = ApiSuccessResponse<ApprovalInboxResult>;
export type ApprovalDetailResponse = ApiSuccessResponse<ApprovalDetail>;
export type ApprovalHistoryResponse = ApiSuccessResponse<ApprovalHistoryResult>;
