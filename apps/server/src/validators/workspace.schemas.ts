import { InvitationStatus, MembershipStatus, WorkspaceRole } from '@procureflow/shared';
import { z } from 'zod';

const workspaceIdSchema = z.string().uuid('The workspace identifier is invalid.');
const memberIdSchema = z.string().uuid('The member identifier is invalid.');
const invitationIdSchema = z.string().uuid('The invitation identifier is invalid.');

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter the member’s email address.')
  .max(254, 'Email addresses must be 254 characters or fewer.')
  .email('Enter a valid email address.');

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

export const workspaceParamsSchema = z.object({ workspaceId: workspaceIdSchema }).strict();

export const memberParamsSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    memberId: memberIdSchema,
  })
  .strict();

export const invitationParamsSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    invitationId: invitationIdSchema,
  })
  .strict();

export const listMembersQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  search: z.string().trim().max(120, 'Search terms must be 120 characters or fewer.').optional(),
  role: z.nativeEnum(WorkspaceRole).optional(),
  status: z.nativeEnum(MembershipStatus).optional(),
});

export const listInvitationsQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  status: z.nativeEnum(InvitationStatus).default(InvitationStatus.Pending),
});

export const inviteMemberSchema = z
  .object({
    email: emailSchema,
    role: z.nativeEnum(WorkspaceRole),
  })
  .strict();

export const changeMemberRoleSchema = z
  .object({
    role: z.nativeEnum(WorkspaceRole),
  })
  .strict();

export const acceptInvitationSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(20, 'The invitation token is invalid.')
      .max(512, 'The invitation token is invalid.')
      .regex(/^[A-Za-z0-9_-]+$/, 'The invitation token is invalid.'),
  })
  .strict();

export type ListMembersQueryInput = z.infer<typeof listMembersQuerySchema>;
export type ListInvitationsQueryInput = z.infer<typeof listInvitationsQuerySchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
