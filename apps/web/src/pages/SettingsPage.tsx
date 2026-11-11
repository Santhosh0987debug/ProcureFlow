import {
  InvitationStatus,
  MembershipStatus,
  Permission,
  ROLE_LABELS,
  WorkspaceRole,
  canAssignRole,
  canManageMember,
} from '@procureflow/shared';
import type {
  CreateInvitationResult,
  InvitationLinkResult,
  WorkspaceInvitationSummary,
  WorkspaceMemberSummary,
} from '@procureflow/shared';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  PauseCircle,
  PlayCircle,
  Search,
  ShieldAlert,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { InvitationLinkDialog } from '../components/settings/InvitationLinkDialog';
import { InviteMemberDialog } from '../components/settings/InviteMemberDialog';
import { RoleSummaryCard } from '../components/settings/RoleSummaryCard';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { messageFrom } from '../lib/api-errors';
import { formatShortDate } from '../lib/format';
import {
  changeMemberRole,
  fetchInvitations,
  fetchMembers,
  reactivateMember,
  regenerateInvitationLink,
  removeMember,
  revokeInvitation,
  suspendMember,
} from '../lib/workspace-api';

const MEMBER_PAGE_SIZE = 10;
const INVITATION_PAGE_SIZE = 10;

const ALL_ROLES: readonly WorkspaceRole[] = [
  WorkspaceRole.Owner,
  WorkspaceRole.Admin,
  WorkspaceRole.ProcurementManager,
  WorkspaceRole.Approver,
  WorkspaceRole.Requester,
  WorkspaceRole.Viewer,
];

type ConfirmAction =
  | { kind: 'role'; member: WorkspaceMemberSummary; role: WorkspaceRole }
  | { kind: 'suspend'; member: WorkspaceMemberSummary }
  | { kind: 'reactivate'; member: WorkspaceMemberSummary }
  | { kind: 'remove'; member: WorkspaceMemberSummary }
  | { kind: 'revoke'; invitation: WorkspaceInvitationSummary };

interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface Feedback {
  tone: 'success' | 'error';
  message: string;
}

const initialMeta: PageMeta = {
  page: 1,
  pageSize: MEMBER_PAGE_SIZE,
  total: 0,
  totalPages: 0,
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function fullName(member: WorkspaceMemberSummary): string {
  return `${member.firstName} ${member.lastName}`.trim();
}

export default function SettingsPage() {
  const { activeWorkspace, hasPermission } = useAuth();
  const workspaceId = activeWorkspace?.id;
  const actorRole = activeWorkspace?.role;
  const canReadMembers = hasPermission(Permission.MembersRead);
  const canInvite = hasPermission(Permission.MembersInvite);
  const canChangeRoles = hasPermission(Permission.MembersRoleChange);
  const canSuspend = hasPermission(Permission.MembersSuspend);
  const canRemove = hasPermission(Permission.MembersRemove);

  const [members, setMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [memberMeta, setMemberMeta] = useState<PageMeta>(initialMeta);
  const [memberPage, setMemberPage] = useState(1);
  const [membersLoading, setMembersLoading] = useState(canReadMembers);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberReload, setMemberReload] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<WorkspaceRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<MembershipStatus | ''>('');

  const [invitations, setInvitations] = useState<WorkspaceInvitationSummary[]>([]);
  const [invitationMeta, setInvitationMeta] = useState<PageMeta>({
    ...initialMeta,
    pageSize: INVITATION_PAGE_SIZE,
  });
  const [invitationPage, setInvitationPage] = useState(1);
  const [invitationsLoading, setInvitationsLoading] = useState(canReadMembers);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);
  const [invitationReload, setInvitationReload] = useState(0);
  const [copyingInvitationId, setCopyingInvitationId] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [linkResult, setLinkResult] = useState<
    CreateInvitationResult | InvitationLinkResult | null
  >(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const assignableRoles = useMemo(
    () =>
      actorRole ? [...ALL_ROLES].reverse().filter((role) => canAssignRole(actorRole, role)) : [],
    [actorRole],
  );

  const hasFilters = search.length > 0 || roleFilter !== '' || statusFilter !== '';

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setMemberPage(1);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeout = window.setTimeout(() => setFeedback(null), 6_000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!workspaceId || !canReadMembers) {
      setMembers([]);
      setMembersLoading(false);
      return;
    }

    const controller = new AbortController();
    setMembersLoading(true);
    setMembersError(null);

    fetchMembers(
      workspaceId,
      {
        page: memberPage,
        pageSize: MEMBER_PAGE_SIZE,
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      },
      controller.signal,
    )
      .then((result) => {
        setMembers(result.items);
        setMemberMeta({
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
        });
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setMembersError(messageFrom(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setMembersLoading(false);
        }
      });

    return () => controller.abort();
  }, [workspaceId, canReadMembers, memberPage, search, roleFilter, statusFilter, memberReload]);

  useEffect(() => {
    if (!workspaceId || !canReadMembers) {
      setInvitations([]);
      setInvitationsLoading(false);
      return;
    }

    const controller = new AbortController();
    setInvitationsLoading(true);
    setInvitationsError(null);

    fetchInvitations(
      workspaceId,
      {
        page: invitationPage,
        pageSize: INVITATION_PAGE_SIZE,
        status: InvitationStatus.Pending,
      },
      controller.signal,
    )
      .then((result) => {
        setInvitations(result.items);
        setInvitationMeta({
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
        });
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setInvitationsError(messageFrom(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setInvitationsLoading(false);
        }
      });

    return () => controller.abort();
  }, [workspaceId, canReadMembers, invitationPage, invitationReload]);

  const closeInviteDialog = useCallback(() => setInviteOpen(false), []);
  const closeLinkDialog = useCallback(() => setLinkResult(null), []);
  const closeConfirmDialog = useCallback(() => {
    setConfirmAction(null);
    setActionError(null);
  }, []);

  function clearFilters(): void {
    setSearchInput('');
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
    setMemberPage(1);
  }

  function handleInvitationCreated(result: CreateInvitationResult): void {
    setInviteOpen(false);
    setLinkResult(result);
    setMemberReload((value) => value + 1);
    setInvitationReload((value) => value + 1);
    setFeedback({
      tone: 'success',
      message: `Invitation created for ${result.invitation.email}.`,
    });
  }

  async function handleCopyInvitationLink(invitation: WorkspaceInvitationSummary): Promise<void> {
    if (!workspaceId || copyingInvitationId) {
      return;
    }

    setCopyingInvitationId(invitation.id);

    try {
      const result = await regenerateInvitationLink(workspaceId, invitation.id);
      setLinkResult(result);
      setInvitationReload((value) => value + 1);
    } catch (error) {
      setFeedback({ tone: 'error', message: messageFrom(error) });
    } finally {
      setCopyingInvitationId(null);
    }
  }

  async function handleConfirmAction(): Promise<void> {
    if (!workspaceId || !confirmAction || actionBusy) {
      return;
    }

    setActionBusy(true);
    setActionError(null);

    try {
      switch (confirmAction.kind) {
        case 'role': {
          const updated = await changeMemberRole(workspaceId, confirmAction.member.id, {
            role: confirmAction.role,
          });
          setFeedback({
            tone: 'success',
            message: `${fullName(updated)} is now ${ROLE_LABELS[updated.role]}.`,
          });
          setMemberReload((value) => value + 1);
          break;
        }
        case 'suspend': {
          const updated = await suspendMember(workspaceId, confirmAction.member.id);
          setFeedback({
            tone: 'success',
            message: `${fullName(updated)} has been suspended from the workspace.`,
          });
          setMemberReload((value) => value + 1);
          break;
        }
        case 'reactivate': {
          const updated = await reactivateMember(workspaceId, confirmAction.member.id);
          setFeedback({
            tone: 'success',
            message: `${fullName(updated)} now has active workspace access.`,
          });
          setMemberReload((value) => value + 1);
          break;
        }
        case 'remove': {
          const removedName = fullName(confirmAction.member);
          await removeMember(workspaceId, confirmAction.member.id);
          setFeedback({
            tone: 'success',
            message: `${removedName} was removed from the workspace.`,
          });

          if (members.length === 1 && memberPage > 1) {
            setMemberPage((value) => value - 1);
          } else {
            setMemberReload((value) => value + 1);
          }
          break;
        }
        case 'revoke': {
          const email = confirmAction.invitation.email;
          await revokeInvitation(workspaceId, confirmAction.invitation.id);
          setFeedback({ tone: 'success', message: `Invitation for ${email} was revoked.` });

          if (invitations.length === 1 && invitationPage > 1) {
            setInvitationPage((value) => value - 1);
          } else {
            setInvitationReload((value) => value + 1);
          }
          break;
        }
      }

      setConfirmAction(null);
    } catch (error) {
      setActionError(messageFrom(error));
    } finally {
      setActionBusy(false);
    }
  }

  const confirmCopy = confirmAction ? confirmDialogCopy(confirmAction) : null;

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        eyebrow="Workspace settings"
        title="Settings"
        description="Manage workspace access, roles and invitations. Every membership change is recorded in the audit trail."
        actions={
          canInvite ? (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-espresso px-4 text-[13px] font-medium text-ivory shadow-[0_1px_2px_rgba(56,44,39,0.18)] transition-colors hover:bg-espresso-light active:translate-y-px"
            >
              <UserPlus size={16} strokeWidth={1.8} aria-hidden="true" />
              Invite member
            </button>
          ) : undefined
        }
      />

      {feedback ? (
        <div
          role="status"
          className={
            feedback.tone === 'success'
              ? 'flex items-start gap-3 rounded-xl border border-sage/25 bg-[#edefe7] px-4 py-3 text-[11.5px] leading-5 text-[#4f5b40]'
              : 'flex items-start gap-3 rounded-xl border border-clay/25 bg-[#f5e7e2] px-4 py-3 text-[11.5px] leading-5 text-[#8a4a3b]'
          }
        >
          {feedback.tone === 'success' ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          )}
          <p className="flex-1">{feedback.message}</p>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss message"
            className="rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <RoleSummaryCard />

      {!canReadMembers ? (
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="Team management is restricted"
            description="Your role can work in this workspace but cannot view the member directory or manage access. Ask a workspace owner or administrator if you need team management permissions."
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-beige/70 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
                  Team members
                </h2>
                <p className="mt-1 text-[11.5px] leading-5 text-stone">
                  Roles are scoped to this workspace. The last active owner cannot be removed or
                  suspended.
                </p>
              </div>
              <span className="rounded-full border border-beige bg-white px-2.5 py-1 text-[9.5px] font-medium text-stone">
                {memberMeta.total} {memberMeta.total === 1 ? 'member' : 'members'}
              </span>
            </div>

            <div className="flex flex-col gap-2.5 border-b border-beige/70 bg-ivory/30 px-5 py-3.5 sm:flex-row sm:items-center sm:px-6">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={14}
                  strokeWidth={1.8}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-taupe"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Search members"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search by name, email or job title"
                  className="h-9 w-full rounded-lg border border-beige bg-white pl-9 pr-3 text-[11.5px] text-espresso outline-none transition-colors placeholder:text-taupe/70 hover:border-taupe/50 focus:border-taupe focus:ring-2 focus:ring-taupe/15"
                />
              </div>

              <select
                aria-label="Filter by role"
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(event.target.value as WorkspaceRole | '');
                  setMemberPage(1);
                }}
                className="h-9 rounded-lg border border-beige bg-white px-2.5 text-[11.5px] text-espresso outline-none focus:border-taupe focus:ring-2 focus:ring-taupe/15"
              >
                <option value="">All roles</option>
                {ALL_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as MembershipStatus | '');
                  setMemberPage(1);
                }}
                className="h-9 rounded-lg border border-beige bg-white px-2.5 text-[11.5px] text-espresso outline-none focus:border-taupe focus:ring-2 focus:ring-taupe/15"
              >
                <option value="">All statuses</option>
                <option value={MembershipStatus.Active}>Active</option>
                <option value={MembershipStatus.Suspended}>Suspended</option>
              </select>

              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-9 items-center justify-center rounded-lg px-2.5 text-[11px] font-medium text-stone transition-colors hover:bg-white hover:text-espresso"
                >
                  Clear
                </button>
              ) : null}
            </div>

            {membersError ? (
              <ErrorPanel
                message={membersError}
                onRetry={() => setMemberReload((value) => value + 1)}
              />
            ) : membersLoading ? (
              <LoadingRows label="Loading members" />
            ) : members.length === 0 ? (
              <EmptyState
                icon={Users}
                compact
                title={hasFilters ? 'No members match these filters' : 'No members yet'}
                description={
                  hasFilters
                    ? 'Try a different search term or clear the role and status filters.'
                    : 'Invite your first teammate to start collaborating in this workspace.'
                }
                action={
                  hasFilters ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-beige bg-white px-3.5 text-[12px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6]"
                    >
                      Clear filters
                    </button>
                  ) : canInvite ? (
                    <button
                      type="button"
                      onClick={() => setInviteOpen(true)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-espresso px-3.5 text-[12px] font-medium text-ivory transition-colors hover:bg-espresso-light"
                    >
                      <UserPlus size={14} aria-hidden="true" />
                      Invite member
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="border-b border-beige/70 bg-ivory/40">
                      <th
                        scope="col"
                        className="px-5 py-2.5 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-taupe sm:px-6"
                      >
                        Member
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2.5 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-taupe"
                      >
                        Role
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2.5 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-taupe"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="hidden px-3 py-2.5 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-taupe md:table-cell"
                      >
                        Joined
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-2.5 text-right text-[8.5px] font-semibold uppercase tracking-[0.14em] text-taupe sm:px-6"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-beige/60">
                    {members.map((member) => (
                      <MemberRow
                        key={member.id}
                        member={member}
                        actorRole={actorRole}
                        assignableRoles={assignableRoles}
                        canChangeRoles={canChangeRoles}
                        canSuspend={canSuspend}
                        canRemove={canRemove}
                        onChangeRole={(target, role) =>
                          setConfirmAction({ kind: 'role', member: target, role })
                        }
                        onSuspend={(target) =>
                          setConfirmAction({ kind: 'suspend', member: target })
                        }
                        onReactivate={(target) =>
                          setConfirmAction({ kind: 'reactivate', member: target })
                        }
                        onRemove={(target) => setConfirmAction({ kind: 'remove', member: target })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {memberMeta.total > 0 ? (
              <Pagination
                meta={memberMeta}
                label="members"
                onPrevious={() => setMemberPage((value) => Math.max(1, value - 1))}
                onNext={() => setMemberPage((value) => Math.min(memberMeta.totalPages, value + 1))}
              />
            ) : null}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-beige/70 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
                  Pending invitations
                </h2>
                <p className="mt-1 text-[11.5px] leading-5 text-stone">
                  Invitations are one-time links. Copying a link rotates the token and invalidates
                  any previous copy.
                </p>
              </div>
              <span className="rounded-full border border-beige bg-white px-2.5 py-1 text-[9.5px] font-medium text-stone">
                {invitationMeta.total} pending
              </span>
            </div>

            {invitationsError ? (
              <ErrorPanel
                message={invitationsError}
                onRetry={() => setInvitationReload((value) => value + 1)}
              />
            ) : invitationsLoading ? (
              <LoadingRows label="Loading invitations" />
            ) : invitations.length === 0 ? (
              <EmptyState
                icon={Mail}
                compact
                title="No pending invitations"
                description="Invite a teammate to create a one-time link for this workspace."
                action={
                  canInvite ? (
                    <button
                      type="button"
                      onClick={() => setInviteOpen(true)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-beige bg-white px-3.5 text-[12px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6]"
                    >
                      <UserPlus size={14} aria-hidden="true" />
                      Invite member
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-beige/60">
                {invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium text-espresso">
                        {invitation.email}
                      </p>
                      <p className="mt-1 text-[10.5px] leading-5 text-stone">
                        {ROLE_LABELS[invitation.role]} · Invited by {invitation.invitedBy.firstName}{' '}
                        {invitation.invitedBy.lastName} · Expires{' '}
                        {formatShortDate(invitation.expiresAt)}
                      </p>
                    </div>

                    {canInvite ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyInvitationLink(invitation)}
                          disabled={copyingInvitationId === invitation.id}
                          aria-label={`Copy link for ${invitation.email}`}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-beige bg-white px-2.5 text-[10.5px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6] disabled:cursor-wait disabled:opacity-60"
                        >
                          {copyingInvitationId === invitation.id ? (
                            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <Mail size={12} className="text-taupe" aria-hidden="true" />
                          )}
                          Copy link
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ kind: 'revoke', invitation })}
                          aria-label={`Revoke invitation for ${invitation.email}`}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[10.5px] font-medium text-clay transition-colors hover:bg-[#f5e7e2]"
                        >
                          <X size={12} aria-hidden="true" />
                          Revoke
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {invitationMeta.totalPages > 1 ? (
              <Pagination
                meta={invitationMeta}
                label="invitations"
                onPrevious={() => setInvitationPage((value) => Math.max(1, value - 1))}
                onNext={() =>
                  setInvitationPage((value) => Math.min(invitationMeta.totalPages, value + 1))
                }
              />
            ) : null}
          </Card>
        </>
      )}

      <InviteMemberDialog
        open={inviteOpen}
        workspaceId={workspaceId ?? ''}
        roles={assignableRoles}
        onClose={closeInviteDialog}
        onCreated={handleInvitationCreated}
      />

      <InvitationLinkDialog result={linkResult} onClose={closeLinkDialog} />

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmCopy?.title ?? ''}
        description={confirmCopy?.description ?? ''}
        confirmLabel={confirmCopy?.confirmLabel ?? 'Confirm'}
        tone={confirmCopy?.tone}
        busy={actionBusy}
        error={actionError}
        onConfirm={handleConfirmAction}
        onCancel={closeConfirmDialog}
      />
    </div>
  );
}

interface MemberRowProps {
  member: WorkspaceMemberSummary;
  actorRole: WorkspaceRole | undefined;
  assignableRoles: readonly WorkspaceRole[];
  canChangeRoles: boolean;
  canSuspend: boolean;
  canRemove: boolean;
  onChangeRole: (member: WorkspaceMemberSummary, role: WorkspaceRole) => void;
  onSuspend: (member: WorkspaceMemberSummary) => void;
  onReactivate: (member: WorkspaceMemberSummary) => void;
  onRemove: (member: WorkspaceMemberSummary) => void;
}

function MemberRow({
  member,
  actorRole,
  assignableRoles,
  canChangeRoles,
  canSuspend,
  canRemove,
  onChangeRole,
  onSuspend,
  onReactivate,
  onRemove,
}: MemberRowProps) {
  const name = fullName(member);
  const manageable =
    !member.isCurrentUser && actorRole ? canManageMember(actorRole, member.role) : false;
  const roleOptions = assignableRoles.filter((role) => role !== member.role);
  const canChange = canChangeRoles && manageable;
  const canToggleStatus = canSuspend && manageable;
  const canDelete = canRemove && manageable;
  const hasActions = canToggleStatus || canDelete;

  return (
    <tr className="transition-colors hover:bg-ivory/40">
      <td className="px-5 py-3.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-beige bg-ivory text-[10px] font-semibold text-stone">
            {member.firstName[0]?.toUpperCase()}
            {member.lastName[0]?.toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[12px] font-medium text-espresso">
              {name}
              {member.isCurrentUser ? (
                <span className="rounded-full bg-parchment px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-stone">
                  You
                </span>
              ) : null}
            </p>
            <p className="truncate text-[10px] text-stone">{member.email}</p>
            {member.jobTitle ? (
              <p className="truncate text-[9.5px] text-taupe">{member.jobTitle}</p>
            ) : null}
          </div>
        </div>
      </td>

      <td className="px-3 py-3.5">
        {canChange && roleOptions.length > 0 ? (
          <select
            aria-label={`Role for ${name}`}
            value={member.role}
            onChange={(event) => {
              const nextRole = event.target.value as WorkspaceRole;

              if (nextRole !== member.role) {
                onChangeRole(member, nextRole);
              }
            }}
            className="h-8 rounded-lg border border-beige bg-white px-2 text-[10.5px] text-espresso outline-none focus:border-taupe focus:ring-2 focus:ring-taupe/15"
          >
            <option value={member.role}>{ROLE_LABELS[member.role]}</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        ) : (
          <span className="inline-flex items-center rounded-full border border-beige bg-white px-2.5 py-1 text-[9.5px] font-medium text-stone">
            {ROLE_LABELS[member.role]}
          </span>
        )}
      </td>

      <td className="px-3 py-3.5">
        <span
          className={
            member.status === MembershipStatus.Active
              ? 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#edefe7] px-2.5 py-1 text-[9.5px] font-medium text-[#4f5b40]'
              : 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#f5e7e2] px-2.5 py-1 text-[9.5px] font-medium text-[#8a4a3b]'
          }
        >
          <span
            className={
              member.status === MembershipStatus.Active
                ? 'h-1.5 w-1.5 rounded-full bg-sage'
                : 'h-1.5 w-1.5 rounded-full bg-clay'
            }
            aria-hidden="true"
          />
          {member.status === MembershipStatus.Active ? 'Active' : 'Suspended'}
        </span>
      </td>

      <td className="hidden px-3 py-3.5 text-[10.5px] text-stone md:table-cell">
        {formatShortDate(member.joinedAt)}
      </td>

      <td className="px-5 py-3.5 sm:px-6">
        <div className="flex items-center justify-end gap-0.5">
          {hasActions ? (
            <>
              {canToggleStatus && member.status === MembershipStatus.Active ? (
                <RowAction
                  label={`Suspend ${name}`}
                  icon={PauseCircle}
                  onClick={() => onSuspend(member)}
                />
              ) : null}
              {canToggleStatus && member.status === MembershipStatus.Suspended ? (
                <RowAction
                  label={`Reactivate ${name}`}
                  icon={PlayCircle}
                  onClick={() => onReactivate(member)}
                />
              ) : null}
              {canDelete ? (
                <RowAction
                  label={`Remove ${name}`}
                  icon={UserMinus}
                  tone="danger"
                  onClick={() => onRemove(member)}
                />
              ) : null}
            </>
          ) : (
            <span className="text-[9.5px] text-taupe">
              {member.isCurrentUser ? 'Your account' : 'View only'}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

function RowAction({
  label,
  icon: Icon,
  tone = 'default',
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  tone?: 'default' | 'danger';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        tone === 'danger'
          ? 'grid h-8 w-8 place-items-center rounded-lg text-clay transition-colors hover:bg-[#f5e7e2]'
          : 'grid h-8 w-8 place-items-center rounded-lg text-stone transition-colors hover:bg-ivory hover:text-espresso'
      }
    >
      <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

function Pagination({
  meta,
  label,
  onPrevious,
  onNext,
}: {
  meta: PageMeta;
  label: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const start = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const end = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-beige/70 bg-ivory/30 px-5 py-3 text-[10px] text-stone sm:px-6">
      <span>
        Showing {start}–{end} of {meta.total} {label}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrevious}
          disabled={meta.page <= 1}
          aria-label={`Previous ${label} page`}
          className="grid h-7 w-7 place-items-center rounded-lg border border-beige bg-white text-stone transition-colors hover:border-taupe/60 hover:text-espresso disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={13} aria-hidden="true" />
        </button>
        <span className="px-1.5 tabular-nums">
          Page {meta.page} of {Math.max(1, meta.totalPages)}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={meta.page >= meta.totalPages}
          aria-label={`Next ${label} page`}
          className="grid h-7 w-7 place-items-center rounded-lg border border-beige bg-white text-stone transition-colors hover:border-taupe/60 hover:text-espresso disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function LoadingRows({ label }: { label: string }) {
  return (
    <div className="space-y-3 px-5 py-5 sm:px-6" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-ivory" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-beige/80" />
            <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-ivory" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-start gap-3 px-5 py-5 sm:px-6">
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-clay" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] leading-5 text-[#8a4a3b]">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex h-8 items-center justify-center rounded-lg border border-beige bg-white px-2.5 text-[10.5px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function confirmDialogCopy(action: ConfirmAction): {
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'primary' | 'danger';
} {
  switch (action.kind) {
    case 'role':
      return {
        title: `Change role for ${fullName(action.member)}?`,
        description: `${fullName(action.member)} will change from ${ROLE_LABELS[action.member.role]} to ${ROLE_LABELS[action.role]}. The change takes effect immediately and is recorded in the audit trail.`,
        confirmLabel: 'Change role',
        tone: action.role === WorkspaceRole.Owner ? 'danger' : 'primary',
      };
    case 'suspend':
      return {
        title: `Suspend ${fullName(action.member)}?`,
        description:
          'They will immediately lose access to this workspace. Their membership and history remain, and an owner or administrator can reactivate them later.',
        confirmLabel: 'Suspend member',
        tone: 'danger',
      };
    case 'reactivate':
      return {
        title: `Reactivate ${fullName(action.member)}?`,
        description:
          'They will regain access to this workspace with their current role. This action is recorded in the audit trail.',
        confirmLabel: 'Reactivate member',
        tone: 'primary',
      };
    case 'remove':
      return {
        title: `Remove ${fullName(action.member)}?`,
        description:
          'This permanently removes their workspace membership. Procurement records they created remain in the workspace. This action is recorded in the audit trail.',
        confirmLabel: 'Remove member',
        tone: 'danger',
      };
    case 'revoke':
      return {
        title: `Revoke the invitation for ${action.invitation.email}?`,
        description:
          'The invitation link will stop working immediately. You can create a new invitation for this email address afterwards.',
        confirmLabel: 'Revoke invitation',
        tone: 'danger',
      };
  }
}
