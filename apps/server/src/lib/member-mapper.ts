import type { Prisma } from '@prisma/client';
import type { MembershipStatus } from '@procureflow/shared';
import type { WorkspaceMemberSummary } from '@procureflow/shared';
import { toMembershipStatus, toWorkspaceRole } from './roles.js';

export const memberInclude = {
  user: true,
} satisfies Prisma.WorkspaceMemberInclude;

export type MemberWithUser = Prisma.WorkspaceMemberGetPayload<{ include: typeof memberInclude }>;

export function toMemberSummary(
  member: MemberWithUser,
  currentUserId: string,
): WorkspaceMemberSummary {
  return {
    id: member.id,
    userId: member.userId,
    firstName: member.user.firstName,
    lastName: member.user.lastName,
    email: member.user.email,
    jobTitle: member.user.jobTitle,
    role: toWorkspaceRole(member.role),
    status: toMembershipStatus(member.status) as MembershipStatus,
    joinedAt: member.joinedAt.toISOString(),
    suspendedAt: member.suspendedAt?.toISOString() ?? null,
    isCurrentUser: member.userId === currentUserId,
  };
}
