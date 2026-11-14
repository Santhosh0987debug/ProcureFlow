import { ApprovalCycleStatus } from '@procureflow/shared';
import type { ApprovalDetail, ApprovalStepRecord } from '@procureflow/shared';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock3,
  FileWarning,
  Loader2,
  Undo2,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  ApprovalHistory,
  ApprovalLevels,
  ApprovalProgress,
} from '../components/approvals/ApprovalSections';
import { PriorityBadge } from '../components/requests/PriorityBadge';
import { RequestErrorPanel, RequestNotice } from '../components/requests/RequestStates';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Card } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { StatusBadge } from '../components/ui/StatusBadge';
import { CATEGORY_LABELS, PRIORITY_LABELS } from '../data/request-options';
import { ApiRequestError } from '../lib/api';
import { messageFrom } from '../lib/api-errors';
import {
  approveApprovalRequest,
  fetchApproval,
  rejectApprovalRequest,
  requestApprovalChanges,
} from '../lib/approval-api';
import { formatAmount, formatShortDate, formatSubmissionTime, getInitials } from '../lib/format';

type DecisionKind = 'approve' | 'reject' | 'request_changes';

const decisionCopy: Record<
  DecisionKind,
  { title: string; description: string; confirmLabel: string; tone: 'primary' | 'danger' }
> = {
  approve: {
    title: 'Approve this request?',
    description:
      'Your decision is recorded against this level. The request moves to the next level or is approved when all required levels are satisfied.',
    confirmLabel: 'Approve request',
    tone: 'primary',
  },
  reject: {
    title: 'Reject this request?',
    description:
      'Rejection ends the active approval cycle and notifies the requester. A reason is required and will be visible in the approval history.',
    confirmLabel: 'Reject request',
    tone: 'danger',
  },
  request_changes: {
    title: 'Request changes?',
    description:
      'The request returns to the requester with your explanation. Previous decisions are preserved and resubmission starts a new approval cycle.',
    confirmLabel: 'Request changes',
    tone: 'primary',
  },
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export default function ApprovalDetailPage() {
  const { activeWorkspace } = useAuth();
  const { approvalId } = useParams<{ approvalId: string }>();
  const workspaceId = activeWorkspace?.id;

  const [approval, setApproval] = useState<ApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const [decision, setDecision] = useState<DecisionKind | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!workspaceId || !approvalId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setNotFound(false);

    fetchApproval(workspaceId, approvalId, controller.signal)
      .then((result) => setApproval(result))
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
  }, [workspaceId, approvalId, reload]);

  function openDecision(kind: DecisionKind): void {
    setDecision(kind);
    setNote('');
    setNoteError(null);
    setActionError(null);
  }

  function closeDecision(): void {
    if (busy) {
      return;
    }

    setDecision(null);
    setNote('');
    setNoteError(null);
    setActionError(null);
  }

  async function submitDecision(): Promise<void> {
    if (!workspaceId || !approvalId || !decision || busy) {
      return;
    }

    const trimmed = note.trim();

    if (decision !== 'approve' && trimmed.length === 0) {
      setNoteError(
        decision === 'reject'
          ? 'Enter a reason for rejecting this request.'
          : 'Explain the changes the requester needs to make.',
      );
      return;
    }

    setBusy(true);
    setActionError(null);
    setNoteError(null);

    try {
      const updated =
        decision === 'approve'
          ? await approveApprovalRequest(workspaceId, approvalId, {
              comment: trimmed || null,
            })
          : decision === 'reject'
            ? await rejectApprovalRequest(workspaceId, approvalId, { reason: trimmed })
            : await requestApprovalChanges(workspaceId, approvalId, {
                explanation: trimmed,
              });

      setApproval(updated);
      setDecision(null);
      setNote('');

      if (decision === 'approve') {
        setNotice(
          updated.status === ApprovalCycleStatus.Approved
            ? `${updated.request.requestNumber} was fully approved.`
            : `Your approval was recorded. ${updated.request.requestNumber} is now at level ${updated.currentLevel}.`,
        );
      } else if (decision === 'reject') {
        setNotice(`${updated.request.requestNumber} was rejected and returned to the requester.`);
      } else {
        setNotice(`${updated.request.requestNumber} was returned to the requester for changes.`);
      }
    } catch (caught) {
      setActionError(messageFrom(caught));
    } finally {
      setBusy(false);
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
            title="Approval not found"
            description="This approval does not exist in the active workspace, or it is no longer available to you."
            action={
              <ButtonLink to="/approvals" variant="primary" icon={ArrowLeft}>
                Back to approvals
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  if (error || !approval) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Approvals"
          title="Approval detail"
          description="Review the request, approval progress and decision history."
          actions={
            <ButtonLink to="/approvals" variant="secondary" icon={ArrowLeft}>
              Back to approvals
            </ButtonLink>
          }
        />
        <RequestErrorPanel
          message={error ?? 'The approval could not be loaded.'}
          onRetry={() => setReload((value) => value + 1)}
        />
      </div>
    );
  }

  const request = approval.request;
  const requesterName = `${request.requester.firstName} ${request.requester.lastName}`.trim();
  const copy = decision ? decisionCopy[decision] : null;
  const showDecisionActions =
    approval.actions.canApprove || approval.actions.canReject || approval.actions.canRequestChanges;

  return (
    <div className="space-y-6 lg:space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/approvals"
          className="inline-flex items-center gap-1.5 rounded-sm text-[11px] font-medium text-stone transition-colors hover:text-espresso"
        >
          <ArrowLeft size={13} strokeWidth={1.8} aria-hidden="true" />
          All approvals
        </Link>
        <Link
          to={`/purchase-requests/${request.id}`}
          className="inline-flex items-center gap-1.5 rounded-sm text-[11px] font-medium text-stone transition-colors hover:text-espresso"
        >
          Open purchase request
        </Link>
      </div>

      {notice ? (
        <RequestNotice tone="success" message={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      <PageHeader
        eyebrow={`${request.requestNumber} · Approval cycle ${approval.cycleNumber}`}
        title={request.title}
        description={request.description}
        actions={
          showDecisionActions ? (
            <>
              <button
                type="button"
                onClick={() => openDecision('approve')}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-espresso px-4 text-[13px] font-medium text-ivory shadow-[0_1px_2px_rgba(56,44,39,0.18)] transition-colors hover:bg-espresso-light active:translate-y-px"
              >
                <Check size={15} strokeWidth={2} aria-hidden="true" />
                Approve
              </button>
              <button
                type="button"
                onClick={() => openDecision('request_changes')}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-beige bg-white px-4 text-[13px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6]"
              >
                <Undo2 size={15} strokeWidth={1.8} aria-hidden="true" />
                Request changes
              </button>
              <button
                type="button"
                onClick={() => openDecision('reject')}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-clay/30 bg-white px-4 text-[13px] font-medium text-clay transition-colors hover:border-clay/60 hover:bg-[#f5e7e2]"
              >
                <X size={15} strokeWidth={2} aria-hidden="true" />
                Reject
              </button>
            </>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={request.status} />
        <StatusBadge status={approval.status} />
        <PriorityBadge priority={request.priority} />
        <span className="inline-flex items-center rounded-full border border-beige bg-white px-2.5 py-1 text-[10px] font-medium leading-none text-stone">
          {CATEGORY_LABELS[request.category]}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10.5px] text-stone">
          <Clock3 size={12} strokeWidth={1.8} aria-hidden="true" />
          Submitted {formatSubmissionTime(approval.requestedAt)}
        </span>
      </div>

      {approval.actions.blockedReason ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-beige bg-ivory/60 px-4 py-3 text-[11px] leading-5 text-stone">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-taupe" aria-hidden="true" />
          <p>{approval.actions.blockedReason}</p>
        </div>
      ) : null}

      <ApprovalProgress approval={approval} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:gap-5">
        <div className="space-y-4 xl:space-y-5">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-beige/70 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
                  Request context
                </h2>
                <p className="mt-1 text-[11.5px] leading-5 text-stone">
                  {request.itemCount} {request.itemCount === 1 ? 'item' : 'items'} requested by{' '}
                  {requesterName}.
                </p>
              </div>
              <p className="text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-taupe">
                Request total
                <span className="mt-1 block text-[17px] font-semibold normal-case tracking-[-0.02em] text-espresso">
                  {formatAmount(request.totalAmount, request.currency)}
                </span>
              </p>
            </div>

            <dl className="grid gap-x-6 gap-y-4 border-b border-beige/70 px-5 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
              <SummaryItem label="Requester" value={requesterName} />
              <SummaryItem label="Department" value={request.department ?? 'Not specified'} />
              <SummaryItem label="Priority" value={PRIORITY_LABELS[request.priority]} />
              <SummaryItem
                label="Needed by"
                value={request.neededBy ? formatShortDate(request.neededBy) : 'Not set'}
              />
            </dl>

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
                  {request.items.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-5 py-3.5 sm:px-6">
                        <p className="text-[12px] font-medium text-espresso">{entry.description}</p>
                        {entry.notes ? (
                          <p className="mt-1 text-[10px] leading-4 text-stone">{entry.notes}</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-right text-[11.5px] tabular-nums text-espresso">
                        {entry.quantity}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3.5 text-[10.5px] text-stone sm:table-cell">
                        {entry.unit}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-right text-[11.5px] tabular-nums text-stone">
                        {formatAmount(entry.unitPrice, request.currency)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-[11.5px] font-semibold tabular-nums text-espresso sm:px-6">
                        {formatAmount(entry.lineTotal, request.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {request.notes ? (
              <div className="border-t border-beige/70 px-5 py-4 sm:px-6">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-taupe">
                  Requester notes
                </p>
                <p className="mt-1.5 whitespace-pre-line text-[11.5px] leading-5 text-stone">
                  {request.notes}
                </p>
              </div>
            ) : null}
          </Card>

          <ApprovalLevels approval={approval} />

          <ApprovalHistory history={approval.history} currentCycle={approval.cycleNumber} />
        </div>

        <div className="space-y-4 xl:space-y-5">
          <Card className="overflow-hidden">
            <div className="border-b border-beige/70 px-5 py-4 sm:px-6">
              <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
                Current approvers
              </h2>
              <p className="mt-1 text-[11px] leading-5 text-stone">
                Level {approval.currentLevel} of {approval.levelCount}
              </p>
            </div>
            <div className="space-y-3 px-5 py-5 sm:px-6">
              {(
                approval.levels.find((level) => level.levelOrder === approval.currentLevel)
                  ?.steps ?? []
              ).map((step) => (
                <ApproverRow key={step.id} step={step} />
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-beige/70 px-5 py-4 sm:px-6">
              <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
                Decision guidance
              </h2>
            </div>
            <div className="space-y-3 px-5 py-5 text-[11px] leading-5 text-stone sm:px-6">
              <p>
                Approval decisions are final for this cycle. Rejection or a change request ends the
                active cycle; the requester can revise and resubmit.
              </p>
              <p>
                Your decision is recorded with your name, the time, and any comment you add. Only
                the approver assigned to the active level can decide.
              </p>
              {approval.workflowName ? (
                <p className="rounded-xl border border-beige bg-ivory/60 px-3 py-2.5">
                  <span className="font-medium text-espresso">Workflow:</span>{' '}
                  {approval.workflowName}
                  {approval.workflowDescription ? ` — ${approval.workflowDescription}` : ''}
                </p>
              ) : null}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-beige/70 px-5 py-4 sm:px-6">
              <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
                Request summary
              </h2>
            </div>
            <dl className="space-y-3 px-5 py-5 sm:px-6">
              <SummaryRow label="Request number" value={request.requestNumber} />
              <SummaryRow label="Category" value={CATEGORY_LABELS[request.category]} />
              <SummaryRow label="Created" value={formatSubmissionTime(request.createdAt)} />
              <SummaryRow
                label="Submitted"
                value={request.submittedAt ? formatSubmissionTime(request.submittedAt) : 'Not yet'}
              />
              <SummaryRow
                label="Approval started"
                value={formatSubmissionTime(approval.requestedAt)}
              />
              <SummaryRow
                label="Cycle"
                value={`${approval.cycleNumber} of ${approval.history.length || 1}`}
              />
              <SummaryRow
                label="Completed"
                value={
                  approval.completedAt ? formatSubmissionTime(approval.completedAt) : 'Pending'
                }
              />
            </dl>
          </Card>
        </div>
      </div>

      <Dialog
        open={decision !== null}
        title={copy?.title ?? 'Record decision'}
        description={copy?.description}
        onClose={closeDecision}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={closeDecision}
              disabled={busy}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-beige bg-white px-3.5 text-[12px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitDecision}
              disabled={busy}
              className={
                copy?.tone === 'danger'
                  ? 'inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-clay px-3.5 text-[12px] font-medium text-white transition-colors hover:bg-[#934f3e] disabled:cursor-wait disabled:opacity-70'
                  : 'inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-espresso px-3.5 text-[12px] font-medium text-ivory transition-colors hover:bg-espresso-light disabled:cursor-wait disabled:opacity-70'
              }
            >
              {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null}
              {copy?.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {actionError ? (
            <p
              role="alert"
              className="rounded-xl border border-clay/25 bg-[#f5e7e2] px-3 py-2.5 text-[11.5px] leading-5 text-[#8a4a3b]"
            >
              {actionError}
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-taupe">
              {decision === 'approve'
                ? 'Comment (optional)'
                : decision === 'reject'
                  ? 'Rejection reason (required)'
                  : 'Explanation for the requester (required)'}
            </span>
            <textarea
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                if (noteError) {
                  setNoteError(null);
                }
              }}
              rows={4}
              maxLength={2000}
              aria-invalid={noteError ? true : undefined}
              aria-describedby={noteError ? 'decision-note-error' : undefined}
              placeholder={
                decision === 'approve'
                  ? 'Add context for the audit trail.'
                  : decision === 'reject'
                    ? 'Explain why this request cannot proceed.'
                    : 'Describe the changes needed before resubmission.'
              }
              className="w-full resize-y rounded-xl border border-beige bg-white px-3 py-2.5 text-[12px] leading-5 text-espresso outline-none transition-colors placeholder:text-taupe/70 focus:border-taupe focus:ring-2 focus:ring-taupe/15"
            />
            {noteError ? (
              <p id="decision-note-error" className="mt-1.5 text-[10.5px] text-clay">
                {noteError}
              </p>
            ) : null}
          </label>

          {decision === 'approve' ? (
            <p className="text-[10px] leading-4 text-taupe">
              The request continues automatically when this level is complete.
            </p>
          ) : (
            <p className="text-[10px] leading-4 text-taupe">
              {note.trim().length}/2000 characters. A clear explanation is required.
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}

function ApproverRow({ step }: { step: ApprovalStepRecord }) {
  const name = step.approver
    ? `${step.approver.firstName} ${step.approver.lastName}`.trim()
    : 'Approver unavailable';

  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-beige bg-ivory text-[10px] font-semibold text-stone">
        {step.approver ? getInitials(name) : <UserRound size={14} aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11.5px] font-medium text-espresso">{name}</p>
        <p className="truncate text-[9.5px] text-taupe">
          {step.approver?.email ?? 'No longer available'}
        </p>
      </div>
      <StatusBadge status={step.status} />
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-taupe">{label}</dt>
      <dd className="mt-1 text-[11.5px] leading-5 text-espresso">{value}</dd>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-taupe">{label}</dt>
      <dd className="max-w-[62%] text-right text-[11px] leading-5 text-espresso">{value}</dd>
    </div>
  );
}
