import { ApprovalStepStatus, Permission } from '@procureflow/shared';
import type { ApprovalInboxItem, ApprovalInboxResult, Priority } from '@procureflow/shared';
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PriorityBadge } from '../components/requests/PriorityBadge';
import { RequestErrorPanel, RequestLoadingBlock } from '../components/requests/RequestStates';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PRIORITY_OPTIONS } from '../data/request-options';
import { messageFrom } from '../lib/api-errors';
import { fetchApprovals } from '../lib/approval-api';
import { formatAmount, formatShortDate } from '../lib/format';

const PAGE_SIZE = 10;

const STEP_STATUS_OPTIONS: Array<{ value: ApprovalStepStatus; label: string }> = [
  { value: ApprovalStepStatus.Pending, label: 'Pending' },
  { value: ApprovalStepStatus.Approved, label: 'Approved' },
  { value: ApprovalStepStatus.Rejected, label: 'Rejected' },
  { value: ApprovalStepStatus.ChangesRequested, label: 'Changes requested' },
  { value: ApprovalStepStatus.Skipped, label: 'Skipped' },
  { value: ApprovalStepStatus.Cancelled, label: 'Cancelled' },
];

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export default function ApprovalsPage() {
  const { activeWorkspace, hasPermission } = useAuth();
  const workspaceId = activeWorkspace?.id;
  const canManageWorkflows = hasPermission(Permission.ApprovalWorkflowsManage);
  const canViewWorkflows = hasPermission(Permission.ApprovalWorkflowsRead);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [requesterInput, setRequesterInput] = useState('');
  const [requester, setRequester] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApprovalStepStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ApprovalInboxResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setRequester(requesterInput.trim());
      setPage(1);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [requesterInput]);

  useEffect(() => {
    if (!workspaceId) {
      setData(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchApprovals(
      workspaceId,
      {
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        requester: requester || undefined,
        minAmount: minAmount || undefined,
        maxAmount: maxAmount || undefined,
        from: from || undefined,
        to: to || undefined,
      },
      controller.signal,
    )
      .then((result) => setData(result))
      .catch((caught: unknown) => {
        if (!isAbortError(caught)) {
          setError(messageFrom(caught));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    workspaceId,
    page,
    search,
    statusFilter,
    priorityFilter,
    requester,
    minAmount,
    maxAmount,
    from,
    to,
    reload,
  ]);

  const hasFilters =
    search.length > 0 ||
    requester.length > 0 ||
    statusFilter !== '' ||
    priorityFilter !== '' ||
    minAmount !== '' ||
    maxAmount !== '' ||
    from !== '' ||
    to !== '';

  function clearFilters(): void {
    setSearchInput('');
    setSearch('');
    setRequesterInput('');
    setRequester('');
    setStatusFilter('');
    setPriorityFilter('');
    setMinAmount('');
    setMaxAmount('');
    setFrom('');
    setTo('');
    setPage(1);
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        eyebrow="Approvals"
        title="Approval inbox"
        description="Review purchase requests assigned to you, see prior decisions, and record a clear approval trail."
        actions={
          canViewWorkflows ? (
            <ButtonLink to="/settings/approval-workflows" variant="secondary" icon={Settings2}>
              {canManageWorkflows ? 'Configure workflows' : 'View workflows'}
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pending"
          value={summary ? String(summary.pending) : '—'}
          tone="pending"
        />
        <MetricCard
          label="Approved"
          value={summary ? String(summary.approved) : '—'}
          tone="approved"
        />
        <MetricCard
          label="Rejected"
          value={summary ? String(summary.rejected) : '—'}
          tone="rejected"
        />
        <MetricCard
          label="Changes requested"
          value={summary ? String(summary.changesRequested) : '—'}
          tone="changes"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="space-y-2.5 border-b border-beige/70 bg-ivory/30 px-5 py-3.5 sm:px-6">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <input
              type="search"
              aria-label="Search approvals"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search request number, title, department or requester"
              className="h-9 min-w-0 flex-1 rounded-lg border border-beige bg-white px-3 text-[11.5px] text-espresso outline-none transition-colors placeholder:text-taupe/70 hover:border-taupe/50 focus:border-taupe focus:ring-2 focus:ring-taupe/15"
            />

            <select
              aria-label="Filter by approval status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as ApprovalStepStatus | '');
                setPage(1);
              }}
              className="h-9 rounded-lg border border-beige bg-white px-2.5 text-[11.5px] text-espresso outline-none focus:border-taupe focus:ring-2 focus:ring-taupe/15"
            >
              <option value="">Pending approvals</option>
              {STEP_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by priority"
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(event.target.value as Priority | '');
                setPage(1);
              }}
              className="h-9 rounded-lg border border-beige bg-white px-2.5 text-[11.5px] text-espresso outline-none focus:border-taupe focus:ring-2 focus:ring-taupe/15"
            >
              <option value="">All priorities</option>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              aria-expanded={showFilters}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-beige bg-white px-2.5 text-[11px] font-medium text-stone transition-colors hover:border-taupe/60 hover:text-espresso"
            >
              <SlidersHorizontal size={13} strokeWidth={1.8} aria-hidden="true" />
              More filters
            </button>

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

          {showFilters ? (
            <div className="grid gap-2.5 border-t border-beige/60 pt-2.5 sm:grid-cols-2 lg:grid-cols-5">
              <label className="block">
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.12em] text-taupe">
                  Requester
                </span>
                <input
                  type="text"
                  aria-label="Filter by requester"
                  value={requesterInput}
                  onChange={(event) => setRequesterInput(event.target.value)}
                  placeholder="Name or email"
                  className="h-9 w-full rounded-lg border border-beige bg-white px-2.5 text-[11px] text-espresso outline-none placeholder:text-taupe/70 focus:border-taupe focus:ring-2 focus:ring-taupe/15"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.12em] text-taupe">
                  Minimum amount
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  aria-label="Minimum amount"
                  value={minAmount}
                  onChange={(event) => {
                    setMinAmount(event.target.value);
                    setPage(1);
                  }}
                  placeholder="0.00"
                  className="h-9 w-full rounded-lg border border-beige bg-white px-2.5 text-[11px] text-espresso outline-none placeholder:text-taupe/70 focus:border-taupe focus:ring-2 focus:ring-taupe/15"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.12em] text-taupe">
                  Maximum amount
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  aria-label="Maximum amount"
                  value={maxAmount}
                  onChange={(event) => {
                    setMaxAmount(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Any"
                  className="h-9 w-full rounded-lg border border-beige bg-white px-2.5 text-[11px] text-espresso outline-none placeholder:text-taupe/70 focus:border-taupe focus:ring-2 focus:ring-taupe/15"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.12em] text-taupe">
                  Submitted from
                </span>
                <input
                  type="date"
                  aria-label="Submitted from"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-full rounded-lg border border-beige bg-white px-2.5 text-[11px] text-espresso outline-none focus:border-taupe focus:ring-2 focus:ring-taupe/15"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.12em] text-taupe">
                  Submitted to
                </span>
                <input
                  type="date"
                  aria-label="Submitted to"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-full rounded-lg border border-beige bg-white px-2.5 text-[11px] text-espresso outline-none focus:border-taupe focus:ring-2 focus:ring-taupe/15"
                />
              </label>
            </div>
          ) : null}
        </div>

        {error ? (
          <RequestErrorPanel
            compact
            message={error}
            onRetry={() => setReload((value) => value + 1)}
          />
        ) : loading ? (
          <RequestLoadingBlock label="Loading assigned approvals" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={BadgeCheck}
            title={hasFilters ? 'No approvals match these filters' : 'Your approval inbox is clear'}
            description={
              hasFilters
                ? 'Try a different status, priority, amount or date range, or clear the filters to see everything assigned to you.'
                : 'Requests routed to you will appear here. Prior decisions remain available through each request’s approval history.'
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
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-beige/70 bg-ivory/40">
                    <TableHeading>Request</TableHeading>
                    <TableHeading>Requester</TableHeading>
                    <TableHeading>Priority</TableHeading>
                    <TableHeading align="right">Amount</TableHeading>
                    <TableHeading className="hidden md:table-cell">Submitted</TableHeading>
                    <TableHeading>Status</TableHeading>
                  </tr>
                </thead>
                <tbody className="divide-y divide-beige/60">
                  {data.items.map((item) => (
                    <ApprovalRow key={item.approvalId + item.levelOrder} item={item} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-beige/70 bg-ivory/30 px-5 py-3 text-[10px] text-stone sm:px-6">
              <span>
                Showing {(data.page - 1) * data.pageSize + 1}–
                {Math.min(data.page * data.pageSize, data.total)} of {data.total}{' '}
                {data.total === 1 ? 'approval' : 'approvals'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={data.page <= 1}
                  aria-label="Previous approval page"
                  className="grid h-7 w-7 place-items-center rounded-lg border border-beige bg-white text-stone transition-colors hover:border-taupe/60 hover:text-espresso disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={13} aria-hidden="true" />
                </button>
                <span className="px-1.5 tabular-nums">
                  Page {data.page} of {Math.max(1, data.totalPages)}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.min(data.totalPages, value + 1))}
                  disabled={data.page >= data.totalPages}
                  aria-label="Next approval page"
                  className="grid h-7 w-7 place-items-center rounded-lg border border-beige bg-white text-stone transition-colors hover:border-taupe/60 hover:text-espresso disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function ApprovalRow({ item }: { item: ApprovalInboxItem }) {
  const requesterName = `${item.requester.firstName} ${item.requester.lastName}`.trim();

  return (
    <tr className="transition-colors hover:bg-ivory/40">
      <td className="px-5 py-3.5 sm:px-6">
        <Link to={`/approvals/${item.approvalId}`} className="group block min-w-0 rounded-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-taupe">
            {item.requestNumber}
          </p>
          <p className="mt-0.5 max-w-[280px] truncate text-[12px] font-medium text-espresso group-hover:underline">
            {item.title}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[9.5px] text-taupe">
            <ClipboardList size={10} strokeWidth={1.8} aria-hidden="true" />
            {item.levelName} · Level {item.levelOrder} of {item.levelCount} · Cycle{' '}
            {item.cycleNumber}
          </p>
        </Link>
      </td>

      <td className="px-3 py-3.5">
        <p className="whitespace-nowrap text-[11.5px] font-medium text-espresso">{requesterName}</p>
        <p className="mt-0.5 text-[9.5px] text-taupe">
          {item.department ?? item.requester.jobTitle ?? 'No department'}
        </p>
      </td>

      <td className="px-3 py-3.5">
        <PriorityBadge priority={item.priority} />
      </td>

      <td className="whitespace-nowrap px-3 py-3.5 text-right text-[12px] font-semibold tabular-nums text-espresso">
        {formatAmount(item.amount, item.currency)}
      </td>

      <td className="hidden whitespace-nowrap px-3 py-3.5 text-[10.5px] text-stone md:table-cell">
        {formatShortDate(item.submittedAt)}
      </td>

      <td className="px-3 py-3.5">
        <StatusBadge status={item.stepStatus} />
      </td>
    </tr>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'pending' | 'approved' | 'rejected' | 'changes';
}) {
  const toneClass = {
    pending: 'text-[#6b5430]',
    approved: 'text-[#4f5b40]',
    rejected: 'text-[#8a4a3b]',
    changes: 'text-[#7a5a35]',
  }[tone];

  return (
    <Card className="px-4 py-4 sm:px-5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-taupe">{label}</p>
      <p className={`mt-2 text-[22px] font-semibold leading-none tracking-[-0.03em] ${toneClass}`}>
        {value}
      </p>
    </Card>
  );
}

function TableHeading({
  children,
  className,
  align = 'left',
}: {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'right';
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-2.5 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-taupe first:pl-5 first:sm:pl-6 last:pr-5 last:sm:pr-6 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className ?? ''}`}
    >
      {children}
    </th>
  );
}
