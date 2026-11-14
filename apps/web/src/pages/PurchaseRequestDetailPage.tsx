import { Permission, RequestStatus } from '@procureflow/shared';
import type { PurchaseRequestActivityEntry, PurchaseRequestDetail } from '@procureflow/shared';
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  FilePenLine,
  FilePlus2,
  FileWarning,
  GitBranch,
  History,
  Pencil,
  Send,
  Trash2,
  Undo2,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  ApprovalHistory,
  ApprovalLevels,
  ApprovalProgress,
  latestDecisionNote,
} from '../components/approvals/ApprovalSections';
import { PriorityBadge } from '../components/requests/PriorityBadge';
import { RequestErrorPanel, RequestNotice } from '../components/requests/RequestStates';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  AUDIT_ACTION_LABELS,
  CATEGORY_LABELS,
  CURRENCY_LABELS,
  PRIORITY_LABELS,
} from '../data/request-options';
import { ApiRequestError } from '../lib/api';
import { messageFrom } from '../lib/api-errors';
import { formatAmount, formatShortDate, formatSubmissionTime, getInitials } from '../lib/format';
import {
  deletePurchaseRequest,
  fetchPurchaseRequest,
  submitPurchaseRequest,
} from '../lib/purchase-request-api';

type ConfirmAction = 'submit' | 'delete';

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export default function PurchaseRequestDetailPage() {
  const { activeWorkspace, hasPermission } = useAuth();
  const { requestId } = useParams<{ requestId: string }>();
  const workspaceId = activeWorkspace?.id;
  const navigate = useNavigate();
  const location = useLocation();

  const [request, setRequest] = useState<PurchaseRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reload, setReload] = useState(0);

  const [notice, setNotice] = useState<string | null>(() => {
    const state = location.state as { notice?: string } | null;
    return state?.notice ?? null;
  });
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (location.state) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  useEffect(() => {
    if (!workspaceId || !requestId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setNotFound(false);

    fetchPurchaseRequest(workspaceId, requestId, controller.signal)
      .then((result) => setRequest(result))
      .catch((caught: unknown) => {
        if (isAbortError(caught)) {
          return;
        }

        if (caught instanceof ApiRequestError && caught.status === 404) {
          setNotFound(true);
          return;
        }

        setError(messageFrom(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [workspaceId, requestId, reload]);

  function closeConfirm(): void {
    setConfirmAction(null);
    setActionError(null);
  }

  async function handleConfirm(): Promise<void> {
    if (!workspaceId || !requestId || !request || !confirmAction || actionBusy) {
      return;
    }

    setActionBusy(true);
    setActionError(null);

    try {
      if (confirmAction === 'submit') {
        const resubmission = request.status === RequestStatus.ChangesRequested;
        const updated = await submitPurchaseRequest(workspaceId, requestId);
        setRequest(updated);
        setNotice(
          resubmission
            ? `${updated.requestNumber} was resubmitted for approval in a new cycle.`
            : `${updated.requestNumber} was submitted for approval.`,
        );
        closeConfirm();
        return;
      }

      await deletePurchaseRequest(workspaceId, requestId);
      navigate('/purchase-requests', {
        replace: true,
        state: { notice: `Draft ${request.requestNumber} deleted.` },
      });
    } catch (caught) {
      setActionError(messageFrom(caught));
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return <PageSkeleton />;
  }

  if (notFound) {
    return (
      <div className="flex min-h-[52vh] items-center justify-center">
        <Card className="w-full max-w-xl">
          <EmptyState
            icon={FileWarning}
            title="Purchase request not found"
            description="This request does not exist in the active workspace, or it may have been deleted."
            action={
              <ButtonLink to="/purchase-requests" variant="primary" icon={ArrowLeft}>
                Back to requests
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Purchase requests"
          title="Purchase request"
          description="Review the request details, line items and activity history."
          actions={
            <ButtonLink to="/purchase-requests" variant="secondary" icon={ArrowLeft}>
              Back to requests
            </ButtonLink>
          }
        />
        <RequestErrorPanel
          message={error ?? 'The purchase request could not be loaded.'}
          onRetry={() => setReload((value) => value + 1)}
        />
      </div>
    );
  }

  const requesterName = `${request.requester.firstName} ${request.requester.lastName}`.trim();
  const isDraft = request.status === RequestStatus.Draft;
  const isChangesRequested = request.status === RequestStatus.ChangesRequested;
  const canViewApproval = hasPermission(Permission.ApprovalsRead);
  const approvalLink =
    request.approval && canViewApproval ? `/approvals/${request.approval.id}` : null;
  const changesRequestNote = isChangesRequested ? latestDecisionNote(request.approval) : null;

  return (
    <div className="space-y-6 lg:space-y-7">
      <div>
        <Link
          to="/purchase-requests"
          className="inline-flex items-center gap-1.5 rounded-sm text-[11px] font-medium text-stone transition-colors hover:text-espresso"
        >
          <ArrowLeft size={13} strokeWidth={1.8} aria-hidden="true" />
          All purchase requests
        </Link>
      </div>

      {notice ? (
        <RequestNotice tone="success" message={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      <PageHeader
        eyebrow={request.requestNumber}
        title={request.title}
        description={request.description}
        actions={
          <>
            {approvalLink ? (
              <ButtonLink to={approvalLink} variant="secondary" icon={BadgeCheck}>
                Open approval
              </ButtonLink>
            ) : null}
            {request.actions.canEdit ? (
              <ButtonLink
                to={`/purchase-requests/${request.id}/edit`}
                variant="secondary"
                icon={Pencil}
              >
                {isChangesRequested ? 'Edit request' : 'Edit draft'}
              </ButtonLink>
            ) : null}
            {request.actions.canSubmit ? (
              <button
                type="button"
                onClick={() => setConfirmAction('submit')}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-espresso px-4 text-[13px] font-medium text-ivory shadow-[0_1px_2px_rgba(56,44,39,0.18)] transition-colors hover:bg-espresso-light active:translate-y-px"
              >
                <Send size={15} strokeWidth={1.8} aria-hidden="true" />
                Submit for approval
              </button>
            ) : null}
            {request.actions.canDelete ? (
              <button
                type="button"
                onClick={() => setConfirmAction('delete')}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-clay/30 bg-white px-4 text-[13px] font-medium text-clay transition-colors hover:border-clay/60 hover:bg-[#f5e7e2]"
              >
                <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" />
                Delete draft
              </button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={request.status} />
        <PriorityBadge priority={request.priority} />
        <span className="inline-flex items-center rounded-full border border-beige bg-white px-2.5 py-1 text-[10px] font-medium leading-none text-stone">
          {CATEGORY_LABELS[request.category]}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10.5px] text-stone">
          <CalendarDays size={12} strokeWidth={1.8} aria-hidden="true" />
          Needed by {request.neededBy ? formatShortDate(request.neededBy) : 'not set'}
        </span>
      </div>

      {isChangesRequested ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-ochre/30 bg-[#f5ebdd] px-4 py-3 text-[11.5px] leading-5 text-[#7a5a35]"
        >
          <Undo2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium">Changes were requested by an approver</p>
            {changesRequestNote ? (
              <p className="mt-1 whitespace-pre-line">{changesRequestNote}</p>
            ) : null}
            <p className="mt-1">
              Edit the request and resubmit when the changes are complete. Resubmission starts a new
              approval cycle and keeps earlier decisions in the approval history.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] xl:gap-5">
        <div className="space-y-4 xl:space-y-5">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-beige/70 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
                  Line items
                </h2>
                <p className="mt-1 text-[11.5px] leading-5 text-stone">
                  {request.itemCount} {request.itemCount === 1 ? 'item' : 'items'} · Totals are
                  calculated by ProcureFlow.
                </p>
              </div>
              <p className="text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-taupe">
                Request total
                <span className="mt-1 block text-[17px] font-semibold normal-case tracking-[-0.02em] text-espresso">
                  {formatAmount(request.totalAmount, request.currency)}
                </span>
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-beige/70 bg-ivory/40">
                    <th
                      scope="col"
                      className="px-5 py-2.5 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-taupe sm:px-6"
                    >
                      Description
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-right text-[8.5px] font-semibold uppercase tracking-[0.14em] text-taupe"
                    >
                      Qty
                    </th>
                    <th
                      scope="col"
                      className="hidden px-3 py-2.5 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-taupe sm:table-cell"
                    >
                      Unit
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-right text-[8.5px] font-semibold uppercase tracking-[0.14em] text-taupe"
                    >
                      Unit price
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-2.5 text-right text-[8.5px] font-semibold uppercase tracking-[0.14em] text-taupe sm:px-6"
                    >
                      Line total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-beige/60">
                  {request.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-3.5 sm:px-6">
                        <p className="text-[12px] font-medium text-espresso">{item.description}</p>
                        {item.category ? (
                          <p className="mt-0.5 text-[9.5px] text-taupe">
                            {CATEGORY_LABELS[item.category]}
                          </p>
                        ) : null}
                        {item.notes ? (
                          <p className="mt-1 text-[10px] leading-4 text-stone">{item.notes}</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-right text-[11.5px] tabular-nums text-espresso">
                        {item.quantity}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3.5 text-[10.5px] text-stone sm:table-cell">
                        {item.unit}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-right text-[11.5px] tabular-nums text-stone">
                        {formatAmount(item.unitPrice, request.currency)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-[11.5px] font-semibold tabular-nums text-espresso sm:px-6">
                        {formatAmount(item.lineTotal, request.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-beige bg-ivory/30">
                    <td
                      colSpan={4}
                      className="px-5 py-3.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-taupe sm:px-6"
                    >
                      Total
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-[14px] font-semibold tabular-nums text-espresso sm:px-6">
                      {formatAmount(request.totalAmount, request.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {request.approval ? (
            <>
              <ApprovalProgress
                approval={request.approval}
                action={
                  approvalLink ? (
                    <ButtonLink to={approvalLink} variant="secondary" icon={BadgeCheck}>
                      Open approval
                    </ButtonLink>
                  ) : undefined
                }
              />
              <ApprovalLevels approval={request.approval} />
              {request.approvalHistory.length > 1 ? (
                <ApprovalHistory
                  history={request.approvalHistory}
                  currentCycle={request.approval.cycleNumber}
                />
              ) : null}
            </>
          ) : request.approvalHistory.length > 0 ? (
            <ApprovalHistory
              history={request.approvalHistory}
              currentCycle={request.approvalHistory[0]?.cycleNumber ?? 0}
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-beige/70 px-5 py-4 sm:px-6">
                <GitBranch size={15} strokeWidth={1.8} className="text-taupe" aria-hidden="true" />
                <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
                  Approval
                </h2>
              </div>
              <EmptyState
                icon={GitBranch}
                compact
                title="Approval has not started"
                description={
                  isDraft
                    ? 'Submitting this draft selects a matching workflow and assigns approvers.'
                    : 'Approval routing will appear here once the request is submitted.'
                }
              />
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-beige/70 px-5 py-4 sm:px-6">
              <History size={15} strokeWidth={1.8} className="text-taupe" aria-hidden="true" />
              <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
                Activity
              </h2>
            </div>

            {request.activity.length === 0 ? (
              <EmptyState
                icon={History}
                compact
                title="No activity recorded yet"
                description="Creation, edits, deletion and submission events will appear here."
              />
            ) : (
              <ol className="px-5 py-5 sm:px-6">
                {request.activity.map((entry, index) => (
                  <ActivityRow
                    key={entry.id}
                    entry={entry}
                    isLast={index === request.activity.length - 1}
                  />
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4 xl:space-y-5">
          <Card className="overflow-hidden">
            <div className="border-b border-beige/70 px-5 py-4 sm:px-6">
              <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
                Request summary
              </h2>
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-beige bg-ivory text-[11px] font-semibold text-stone">
                  {getInitials(requesterName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-espresso">{requesterName}</p>
                  <p className="truncate text-[10px] text-stone">{request.requester.email}</p>
                  {request.requester.jobTitle ? (
                    <p className="truncate text-[9.5px] text-taupe">{request.requester.jobTitle}</p>
                  ) : null}
                </div>
              </div>

              <dl className="space-y-3 border-t border-beige/60 pt-4">
                <SummaryRow label="Department" value={request.department ?? 'Not specified'} />
                <SummaryRow label="Category" value={CATEGORY_LABELS[request.category]} />
                <SummaryRow label="Priority" value={PRIORITY_LABELS[request.priority]} />
                <SummaryRow label="Currency" value={CURRENCY_LABELS[request.currency]} />
                <SummaryRow
                  label="Needed by"
                  value={request.neededBy ? formatShortDate(request.neededBy) : 'Not set'}
                />
                <SummaryRow label="Created" value={formatSubmissionTime(request.createdAt)} />
                <SummaryRow label="Updated" value={formatSubmissionTime(request.updatedAt)} />
                {request.submittedAt ? (
                  <SummaryRow label="Submitted" value={formatSubmissionTime(request.submittedAt)} />
                ) : null}
                {request.decidedAt ? (
                  <SummaryRow label="Decided" value={formatSubmissionTime(request.decidedAt)} />
                ) : null}
              </dl>

              <p className="rounded-xl border border-beige bg-ivory/60 px-3 py-2.5 text-[10px] leading-4 text-stone">
                {statusGuidance(request.status)}
              </p>
            </div>
          </Card>

          {request.notes ? (
            <Card className="overflow-hidden">
              <div className="border-b border-beige/70 px-5 py-4 sm:px-6">
                <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
                  Notes
                </h2>
              </div>
              <p className="whitespace-pre-line px-5 py-5 text-[11.5px] leading-5 text-stone sm:px-6">
                {request.notes}
              </p>
            </Card>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction === 'submit'
            ? isChangesRequested
              ? `Resubmit ${request.requestNumber} for approval?`
              : `Submit ${request.requestNumber} for approval?`
            : `Delete ${request.requestNumber}?`
        }
        description={
          confirmAction === 'submit'
            ? isChangesRequested
              ? 'Your updates will start a new approval cycle. Earlier decisions remain in the approval history, and the request is locked while the new cycle is reviewed.'
              : 'The draft will be locked and routed for approval. It cannot be edited, deleted or submitted again afterwards.'
            : 'This removes the draft from the workspace. The append-only audit trail keeps a record of the deletion.'
        }
        confirmLabel={
          confirmAction === 'submit'
            ? isChangesRequested
              ? 'Resubmit request'
              : 'Submit request'
            : 'Delete draft'
        }
        tone={confirmAction === 'submit' ? 'primary' : 'danger'}
        busy={actionBusy}
        error={actionError}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}

function statusGuidance(status: RequestStatus): string {
  switch (status) {
    case RequestStatus.Draft:
      return 'This request is still a draft. Only drafts can be edited, deleted or submitted.';
    case RequestStatus.Submitted:
      return 'This request has been submitted and is being routed to approvers.';
    case RequestStatus.PendingApproval:
      return 'This request is locked while it moves through approval. Editing and deletion are not available.';
    case RequestStatus.ChangesRequested:
      return 'An approver requested changes. Edit the request and resubmit to start a new approval cycle.';
    case RequestStatus.Approved:
      return 'This request was approved. Editing and deletion are no longer available.';
    case RequestStatus.Rejected:
      return 'This request was rejected. The approval cycle is closed and the request cannot be edited or resubmitted.';
    case RequestStatus.Cancelled:
      return 'This request was cancelled and can no longer be edited.';
    default:
      return 'This request is no longer editable.';
  }
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-taupe">{label}</dt>
      <dd className="max-w-[62%] text-right text-[11px] leading-5 text-espresso">{value}</dd>
    </div>
  );
}

function activityIcon(action: string): LucideIcon {
  switch (action) {
    case 'purchase_request.created':
      return FilePlus2;
    case 'purchase_request.updated':
      return FilePenLine;
    case 'purchase_request.submitted':
      return Send;
    case 'purchase_request.deleted':
      return Trash2;
    default:
      return History;
  }
}

function ActivityRow({ entry, isLast }: { entry: PurchaseRequestActivityEntry; isLast: boolean }) {
  const Icon = activityIcon(entry.action);
  const actor = entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}`.trim() : 'System';

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!isLast ? (
        <span
          className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-beige"
          aria-hidden="true"
        />
      ) : null}
      <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-beige bg-white text-stone">
        <Icon size={13} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-medium text-espresso">
          {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
        </p>
        {entry.summary ? (
          <p className="mt-0.5 text-[10.5px] leading-5 text-stone">{entry.summary}</p>
        ) : null}
        <p className="mt-1 flex items-center gap-1.5 text-[9.5px] text-taupe">
          <UserRound size={10} strokeWidth={1.8} aria-hidden="true" />
          {actor} · {formatSubmissionTime(entry.occurredAt)}
        </p>
      </div>
    </li>
  );
}
