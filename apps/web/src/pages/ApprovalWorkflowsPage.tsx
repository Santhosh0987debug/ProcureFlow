import { Permission } from '@procureflow/shared';
import type { ApprovalWorkflowListResult, ApprovalWorkflowSummary } from '@procureflow/shared';
import {
  BadgeCheck,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  RequestErrorPanel,
  RequestLoadingBlock,
  RequestNotice,
} from '../components/requests/RequestStates';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import {
  activateApprovalWorkflow,
  deactivateApprovalWorkflow,
  deleteApprovalWorkflow,
  fetchApprovalWorkflows,
} from '../lib/approval-api';
import { messageFrom } from '../lib/api-errors';
import { formatAmount, formatShortDate } from '../lib/format';

const PAGE_SIZE = 20;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export default function ApprovalWorkflowsPage() {
  const { activeWorkspace, hasPermission } = useAuth();
  const workspaceId = activeWorkspace?.id;
  const canManage = hasPermission(Permission.ApprovalWorkflowsManage);
  const location = useLocation();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'default' | ''>('');
  const [data, setData] = useState<ApprovalWorkflowListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApprovalWorkflowSummary | null>(null);
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

    fetchApprovalWorkflows(
      workspaceId,
      {
        page: 1,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: statusFilter || undefined,
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
  }, [workspaceId, search, statusFilter, reload]);

  async function toggleActive(workflow: ApprovalWorkflowSummary): Promise<void> {
    if (!workspaceId || busyId) {
      return;
    }

    setBusyId(workflow.id);
    setActionError(null);

    try {
      if (workflow.isActive) {
        await deactivateApprovalWorkflow(workspaceId, workflow.id);
        setNotice(`“${workflow.name}” was deactivated.`);
      } else {
        await activateApprovalWorkflow(workspaceId, workflow.id);
        setNotice(`“${workflow.name}” is now active.`);
      }

      setReload((value) => value + 1);
    } catch (caught) {
      setActionError(messageFrom(caught));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!workspaceId || !deleteTarget || busyId) {
      return;
    }

    setBusyId(deleteTarget.id);
    setActionError(null);

    try {
      await deleteApprovalWorkflow(workspaceId, deleteTarget.id);
      setNotice(`“${deleteTarget.name}” was deleted.`);
      setDeleteTarget(null);
      setReload((value) => value + 1);
    } catch (caught) {
      setActionError(messageFrom(caught));
    } finally {
      setBusyId(null);
    }
  }

  const hasFilters = search.length > 0 || statusFilter !== '';

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        eyebrow="Settings · Approvals"
        title="Approval workflows"
        description="Configure who reviews purchase requests, in what order, and which amount bands route to each workflow."
        actions={
          canManage ? (
            <ButtonLink to="/settings/approval-workflows/new" variant="primary" icon={Plus}>
              New workflow
            </ButtonLink>
          ) : undefined
        }
      />

      {notice ? (
        <RequestNotice tone="success" message={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      {actionError ? (
        <RequestNotice tone="error" message={actionError} onDismiss={() => setActionError(null)} />
      ) : null}

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
              aria-label="Search approval workflows"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search workflows by name or description"
              className="h-9 w-full rounded-lg border border-beige bg-white pl-9 pr-3 text-[11.5px] text-espresso outline-none transition-colors placeholder:text-taupe/70 hover:border-taupe/50 focus:border-taupe focus:ring-2 focus:ring-taupe/15"
            />
          </div>

          <select
            aria-label="Filter workflows by status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as 'active' | 'inactive' | 'default' | '')
            }
            className="h-9 rounded-lg border border-beige bg-white px-2.5 text-[11.5px] text-espresso outline-none focus:border-taupe focus:ring-2 focus:ring-taupe/15"
          >
            <option value="">All workflows</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="default">Default</option>
          </select>

          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearch('');
                setStatusFilter('');
              }}
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
          <RequestLoadingBlock label="Loading approval workflows" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title={hasFilters ? 'No workflows match these filters' : 'No approval workflows yet'}
            description={
              hasFilters
                ? 'Try a different name or status filter.'
                : 'Create a workflow to define approval levels, assignees and amount conditions. Requests cannot be submitted until an active workflow matches them.'
            }
            action={
              canManage && !hasFilters ? (
                <ButtonLink to="/settings/approval-workflows/new" variant="primary" icon={Plus}>
                  New workflow
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-beige/60">
            {data.items.map((workflow) => (
              <WorkflowRow
                key={workflow.id}
                workflow={workflow}
                canManage={canManage}
                busy={busyId === workflow.id}
                onToggle={() => void toggleActive(workflow)}
                onDelete={() => {
                  setActionError(null);
                  setDeleteTarget(workflow);
                }}
              />
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete “${deleteTarget?.name ?? 'workflow'}”?`}
        description="This permanently removes the workflow configuration. Workflows already used for approvals cannot be deleted; deactivate them instead to preserve history."
        confirmLabel="Delete workflow"
        tone="danger"
        busy={busyId === deleteTarget?.id}
        error={deleteTarget ? actionError : null}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!busyId) {
            setDeleteTarget(null);
            setActionError(null);
          }
        }}
      />
    </div>
  );
}

function WorkflowRow({
  workflow,
  canManage,
  busy,
  onToggle,
  onDelete,
}: {
  workflow: ApprovalWorkflowSummary;
  canManage: boolean;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const amountCondition =
    workflow.minAmount && workflow.maxAmount
      ? `${formatAmount(workflow.minAmount, workflow.currency)} – ${formatAmount(
          workflow.maxAmount,
          workflow.currency,
        )}`
      : workflow.minAmount
        ? `Above ${formatAmount(workflow.minAmount, workflow.currency)}`
        : workflow.maxAmount
          ? `Up to ${formatAmount(workflow.maxAmount, workflow.currency)}`
          : 'All amounts';

  return (
    <li className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/settings/approval-workflows/${workflow.id}/edit`}
              className="text-[13px] font-semibold text-espresso hover:underline"
            >
              {workflow.name}
            </Link>
            <span
              className={
                workflow.isActive
                  ? 'rounded-full bg-[#edefe7] px-2 py-0.5 text-[9px] font-medium text-[#4f5b40]'
                  : 'rounded-full bg-[#f2efea] px-2 py-0.5 text-[9px] font-medium text-[#6f6258]'
              }
            >
              {workflow.isActive ? 'Active' : 'Inactive'}
            </span>
            {workflow.isDefault ? (
              <span className="rounded-full bg-[#f4eddf] px-2 py-0.5 text-[9px] font-medium text-[#6b5430]">
                Default
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-stone">
            {workflow.description ?? 'No description provided.'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9.5px] text-taupe">
            <span className="inline-flex items-center gap-1">
              <GitBranch size={10} strokeWidth={1.8} aria-hidden="true" />
              {workflow.levelCount} {workflow.levelCount === 1 ? 'level' : 'levels'} ·{' '}
              {workflow.approverCount} {workflow.approverCount === 1 ? 'approver' : 'approvers'}
            </span>
            <span>
              {workflow.currency} · {amountCondition}
            </span>
            <span>Updated {formatShortDate(workflow.updatedAt)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {canManage ? (
            <>
              <Link
                to={`/settings/approval-workflows/${workflow.id}/edit`}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-beige bg-white px-2.5 text-[10.5px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6]"
              >
                <Pencil size={12} strokeWidth={1.8} aria-hidden="true" />
                Edit
              </Link>
              <button
                type="button"
                onClick={onToggle}
                disabled={busy}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-beige bg-white px-2.5 text-[10.5px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6] disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                ) : workflow.isActive ? (
                  <PowerOff size={12} strokeWidth={1.8} aria-hidden="true" />
                ) : (
                  <Power size={12} strokeWidth={1.8} aria-hidden="true" />
                )}
                {workflow.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                aria-label={`Delete ${workflow.name}`}
                className="grid h-8 w-8 place-items-center rounded-lg border border-beige bg-white text-clay transition-colors hover:border-clay/50 hover:bg-[#f5e7e2] disabled:cursor-wait disabled:opacity-60"
              >
                <Trash2 size={12} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[10px] text-taupe">
              <BadgeCheck size={12} strokeWidth={1.8} aria-hidden="true" />
              Read only
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
