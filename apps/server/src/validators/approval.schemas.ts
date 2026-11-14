import { Prisma } from '@prisma/client';
import {
  ApprovalLevelRule,
  ApproverAssignmentType,
  ApprovalStepStatus,
  Currency,
  Priority,
  WorkspaceRole,
} from '@procureflow/shared';
import { z } from 'zod';

const workspaceIdSchema = z.string().uuid('The workspace identifier is invalid.');
const workflowIdSchema = z.string().uuid('The workflow identifier is invalid.');
const approvalIdSchema = z.string().uuid('The approval identifier is invalid.');
const requestIdSchema = z.string().uuid('The request identifier is invalid.');

const pageSchema = z.coerce
  .number('Enter a valid page number.')
  .int('Enter a valid page number.')
  .min(1, 'Page numbers start at 1.')
  .default(1);

const pageSizeSchema = z.coerce
  .number('Enter a valid page size.')
  .int('Enter a valid page size.')
  .min(1, 'Page size must be at least 1.')
  .max(100, 'Page size must be 100 or fewer.')
  .default(20);

function optionalTextSchema(maxLength: number, label: string) {
  return z
    .string()
    .trim()
    .max(maxLength, `${label} must be ${maxLength} characters or fewer.`)
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null));
}

const optionalAmountSchema = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) {
      return null;
    }

    return typeof value === 'number' ? String(value) : value.trim();
  })
  .superRefine((value, context) => {
    if (value === null || value === '') {
      return;
    }

    if (!/^\d{1,12}(\.\d{1,2})?$/.test(value)) {
      context.addIssue({
        code: 'custom',
        message: 'Amount conditions must be a number with up to two decimal places.',
      });
    }
  })
  .transform((value) => (value === '' ? null : value));

export const workspaceApprovalParamsSchema = z.object({ workspaceId: workspaceIdSchema }).strict();

export const approvalWorkflowParamsSchema = z
  .object({ workspaceId: workspaceIdSchema, workflowId: workflowIdSchema })
  .strict();

export const approvalParamsSchema = z
  .object({ workspaceId: workspaceIdSchema, approvalId: approvalIdSchema })
  .strict();

export const requestApprovalHistoryParamsSchema = z
  .object({ workspaceId: workspaceIdSchema, requestId: requestIdSchema })
  .strict();

export const listApprovalWorkflowsQuerySchema = z
  .object({
    page: pageSchema,
    pageSize: pageSizeSchema,
    search: z.string().trim().max(180, 'Search terms must be 180 characters or fewer.').optional(),
    status: z.enum(['active', 'inactive', 'default']).optional(),
  })
  .strict();

export const listApprovalsQuerySchema = z
  .object({
    page: pageSchema,
    pageSize: pageSizeSchema,
    search: z.string().trim().max(180, 'Search terms must be 180 characters or fewer.').optional(),
    status: z.nativeEnum(ApprovalStepStatus).optional(),
    priority: z.nativeEnum(Priority).optional(),
    requester: z
      .string()
      .trim()
      .max(180, 'Requester filters must be 180 characters or fewer.')
      .optional(),
    requesterId: z.string().uuid('The requester identifier is invalid.').optional(),
    minAmount: optionalAmountSchema,
    maxAmount: optionalAmountSchema,
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict()
  .refine((query) => !query.from || !query.to || query.from.getTime() <= query.to.getTime(), {
    message: 'The start date must be on or before the end date.',
    path: ['to'],
  })
  .refine(
    (query) =>
      !query.minAmount ||
      !query.maxAmount ||
      !new Prisma.Decimal(query.minAmount).gt(query.maxAmount),
    {
      message: 'The minimum amount must be less than or equal to the maximum amount.',
      path: ['maxAmount'],
    },
  );

const workflowApproverSchema = z.discriminatedUnion('assignmentType', [
  z
    .object({
      assignmentType: z.literal(ApproverAssignmentType.Member),
      memberId: z.string().uuid('Select a valid workspace member.'),
    })
    .strict(),
  z
    .object({
      assignmentType: z.literal(ApproverAssignmentType.Role),
      role: z.nativeEnum(WorkspaceRole, { error: 'Select a valid workspace role.' }),
    })
    .strict(),
]);

const workflowLevelSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter a name for every approval level.')
      .max(140, 'Level names must be 140 characters or fewer.'),
    completionRule: z.nativeEnum(ApprovalLevelRule, {
      error: 'Select how this level should be completed.',
    }),
    approvers: z
      .array(workflowApproverSchema)
      .min(1, 'Add at least one approver to every level.')
      .max(20, 'A level can contain at most 20 approvers.'),
  })
  .strict()
  .superRefine((level, context) => {
    const memberIds = new Set<string>();
    const roles = new Set<string>();

    level.approvers.forEach((approver, index) => {
      if (approver.assignmentType === ApproverAssignmentType.Member) {
        if (memberIds.has(approver.memberId)) {
          context.addIssue({
            code: 'custom',
            path: ['approvers', index],
            message: 'Each member can appear only once in a level.',
          });
        }

        memberIds.add(approver.memberId);
        return;
      }

      if (roles.has(approver.role)) {
        context.addIssue({
          code: 'custom',
          path: ['approvers', index],
          message: 'Each role can appear only once in a level.',
        });
      }

      roles.add(approver.role);
    });
  });

export const approvalWorkflowWriteSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter a workflow name.')
      .max(120, 'Workflow names must be 120 characters or fewer.'),
    description: optionalTextSchema(2000, 'Workflow descriptions'),
    isDefault: z.boolean().default(false),
    currency: z.nativeEnum(Currency, { error: 'Select a currency.' }),
    minAmount: optionalAmountSchema,
    maxAmount: optionalAmountSchema,
    levels: z
      .array(workflowLevelSchema)
      .min(1, 'Add at least one approval level.')
      .max(10, 'A workflow can contain at most 10 levels.'),
  })
  .strict()
  .superRefine((workflow, context) => {
    if (workflow.minAmount && workflow.maxAmount) {
      if (new Prisma.Decimal(workflow.minAmount).gt(workflow.maxAmount)) {
        context.addIssue({
          code: 'custom',
          path: ['maxAmount'],
          message: 'The maximum amount must be greater than or equal to the minimum amount.',
        });
      }
    }
  });

export const approveApprovalSchema = z
  .object({
    comment: optionalTextSchema(2000, 'Approval comments'),
  })
  .strict();

export const rejectApprovalSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, 'Enter a reason for rejecting this request.')
      .max(2000, 'Rejection reasons must be 2000 characters or fewer.'),
  })
  .strict();

export const requestApprovalChangesSchema = z
  .object({
    explanation: z
      .string()
      .trim()
      .min(1, 'Explain the changes the requester needs to make.')
      .max(2000, 'Change explanations must be 2000 characters or fewer.'),
  })
  .strict();

export type ApprovalWorkflowWriteInput = z.infer<typeof approvalWorkflowWriteSchema>;
export type ListApprovalWorkflowsQueryInput = z.infer<typeof listApprovalWorkflowsQuerySchema>;
export type ListApprovalsQueryInput = z.infer<typeof listApprovalsQuerySchema>;
export type ApproveApprovalInput = z.infer<typeof approveApprovalSchema>;
export type RejectApprovalInput = z.infer<typeof rejectApprovalSchema>;
export type RequestApprovalChangesInput = z.infer<typeof requestApprovalChangesSchema>;
