import { Permission } from '@procureflow/shared';
import type {
  ProcurementCategory,
  PurchaseRequestListResult,
  PurchaseRequestListSummary,
  Priority,
  RequestStatus,
} from '@procureflow/shared';
import { ChevronLeft, ChevronRight, FileText, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PriorityBadge } from '../components/requests/PriorityBadge';
import {
  RequestErrorPanel,
  RequestLoadingBlock,
  RequestNotice,
} from '../components/requests/RequestStates';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  PRIORITY_OPTIONS,
  REQUEST_STATUS_OPTIONS,
} from '../data/request-options';
import { messageFrom } from '../lib/api-errors';
import { formatAmount, formatShortDate } from '../lib/format';
import { fetchPurchaseRequests } from '../lib/purchase-request-api';

const PAGE_SIZE = 10;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export default function PurchaseRequestsPage() {
  const { activeWorkspace, hasPermission } = useAuth();
  const workspaceId = activeWorkspace?.id;
  const canCreate = hasPermission(Permission.RequestsCreate);
  const location = useLocation();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<ProcurementCategory | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PurchaseRequestListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [notice, setNotice] = useState<string | null>(() => {
    const state = location.state as { notice?: string } | null;
    return state?.notice ?? null;
  });

  useEffect(() => {
    if (location.state) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!workspaceId) {
      setData(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchPurchaseRequests(
      workspaceId,
      {
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        priority: priorityFilter || undefined,
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
  }, [workspaceId, page, search, statusFilter, categoryFilter, priorityFilter, reload]);

  const hasFilters =
    search.length > 0 || statusFilter !== '' || categoryFilter !== '' || priorityFilter !== '';

  function clearFilters(): void {
    setSearchInput('');
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setPriorityFilter('');
    setPage(1);
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        eyebrow="Procurement"
        title="Purchase Requests"
        description="Create, review and submit purchase intent. Drafts stay editable until they are submitted for approval."
        actions={
          canCreate ? (
            <ButtonLink to="/purchase-requests/new" variant="primary" icon={Plus}>
              New request
            </ButtonLink>
          ) : undefined
        }
      />

      {notice ? (
        <RequestNotice tone="success" message={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total requests" value={summary ? String(summary.total) : '—'} />
        <MetricCard label="Drafts" value={summary ? String(summary.draft) : '—'} />
        <MetricCard
          label="Pending approval"
          value={summary ? String(summary.pendingApproval) : '—'}
        />
        <MetricCard label="Approved" value={summary ? String(summary.approved) : '—'} />
      </div>

      <Card className="overflow-hidden">
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
              aria-label="Search purchase requests"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by request number, title or department"
              className="h-9 w-full rounded-lg border border-beige bg-white pl-9 pr-3 text-[11.5px] text-espresso outline-none transition-colors placeholder:text-taupe/70 hover:border-taupe/50 focus:border-taupe focus:ring-2 focus:ring-taupe/15"
            />
          </div>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as RequestStatus | '');
              setPage(1);
            }}
            className="h-9 rounded-lg border border-beige bg-white px-2.5 text-[11.5px] text-espresso outline-none focus:border-taupe focus:ring-2 focus:ring-taupe/15"
          >
            <option value="">All statuses</option>
            {REQUEST_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value as ProcurementCategory | '');
              setPage(1);
            }}
            className="h-9 rounded-lg border border-beige bg-white px-2.5 text-[11.5px] text-espresso outline-none focus:border-taupe focus:ring-2 focus:ring-taupe/15"
          >
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((option) => (
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

        {error ? (
          <RequestErrorPanel
            compact
            message={error}
            onRetry={() => setReload((value) => value + 1)}
          />
        ) : loading ? (
          <RequestLoadingBlock label="Loading purchase requests" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={hasFilters ? 'No requests match these filters' : 'No purchase requests yet'}
            description={
              hasFilters
                ? 'Try a different search term or clear the status, category and priority filters.'
                : 'Create the first purchase request to start a clear, auditable intake trail for your team.'
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
              ) : canCreate ? (
                <ButtonLink to="/purchase-requests/new" variant="primary" icon={Plus}>
                  New request
                </ButtonLink>
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
                    <TableHeading className="hidden lg:table-cell">Category</TableHeading>
                    <TableHeading>Priority</TableHeading>
                    <TableHeading align="right">Total</TableHeading>
                    <TableHeading>Status</TableHeading>
                    <TableHeading className="hidden md:table-cell">Needed by</TableHeading>
                  </tr>
                </thead>
                <tbody className="divide-y divide-beige/60">
                  {data.items.map((request) => (
                    <RequestRow key={request.id} request={request} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-beige/70 bg-ivory/30 px-5 py-3 text-[10px] text-stone sm:px-6">
              <span>
                Showing {(data.page - 1) * data.pageSize + 1}–
                {Math.min(data.page * data.pageSize, data.total)} of {data.total}{' '}
                {data.total === 1 ? 'request' : 'requests'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={data.page <= 1}
                  aria-label="Previous request page"
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
                  aria-label="Next request page"
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

function RequestRow({ request }: { request: PurchaseRequestListSummary }) {
  return (
    <tr className="transition-colors hover:bg-ivory/40">
      <td className="px-5 py-3.5 sm:px-6">
        <Link to={`/purchase-requests/${request.id}`} className="group block min-w-0 rounded-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-taupe">
            {request.requestNumber}
          </p>
          <p className="mt-0.5 max-w-[260px] truncate text-[12px] font-medium text-espresso group-hover:underline">
            {request.title}
          </p>
          <p className="mt-0.5 text-[9.5px] text-taupe">
            Created {formatShortDate(request.createdAt)} · {request.itemCount}{' '}
            {request.itemCount === 1 ? 'item' : 'items'}
          </p>
        </Link>
      </td>

      <td className="px-3 py-3.5">
        <p className="whitespace-nowrap text-[11.5px] font-medium text-espresso">
          {request.requester.firstName} {request.requester.lastName}
        </p>
        <p className="mt-0.5 text-[9.5px] text-taupe">
          {request.department ?? request.requester.jobTitle ?? 'No department'}
        </p>
      </td>

      <td className="hidden px-3 py-3.5 text-[10.5px] text-stone lg:table-cell">
        {CATEGORY_LABELS[request.category]}
      </td>

      <td className="px-3 py-3.5">
        <PriorityBadge priority={request.priority} />
      </td>

      <td className="whitespace-nowrap px-3 py-3.5 text-right text-[12px] font-semibold tabular-nums text-espresso">
        {formatAmount(request.totalAmount, request.currency)}
      </td>

      <td className="px-3 py-3.5">
        <StatusBadge status={request.status} />
      </td>

      <td className="hidden whitespace-nowrap px-3 py-3.5 text-[10.5px] text-stone md:table-cell">
        {request.neededBy ? formatShortDate(request.neededBy) : '—'}
      </td>
    </tr>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-4 py-4 sm:px-5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-taupe">{label}</p>
      <p className="mt-2 text-[22px] font-semibold leading-none tracking-[-0.03em] text-espresso">
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
