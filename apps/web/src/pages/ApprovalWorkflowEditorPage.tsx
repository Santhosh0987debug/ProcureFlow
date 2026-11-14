import {
  ApprovalLevelRule,
  ApproverAssignmentType,
  Currency,
  MembershipStatus,
  Permission,
  ROLE_LABELS,
  WorkspaceRole,
  roleHasPermission,
} from '@procureflow/shared';
import type {
  ApprovalWorkflowDetail,
  ApprovalWorkflowPreview,
  ApprovalWorkflowWriteRequest,
  WorkspaceMemberSummary,
} from '@procureflow/shared';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  GitBranch,
  Loader2,
  Plus,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { RequestErrorPanel, RequestNotice } from '../components/requests/RequestStates';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { CURRENCY_OPTIONS } from '../data/request-options';
import { ApiRequestError } from '../lib/api';
import { fieldErrorsFrom, messageFrom } from '../lib/api-errors';
import {
  activateApprovalWorkflow,
  createApprovalWorkflow,
  fetchApprovalWorkflow,
  previewApprovalWorkflow,
  updateApprovalWorkflow,
} from '../lib/approval-api';
import { fetchMembers } from '../lib/workspace-api';

interface ApproverDraft {
  key: string;
  assignmentType: ApproverAssignmentType;
  memberId: string;
  role: WorkspaceRole;
}

interface LevelDraft {
  key: string;
  name: string;
  completionRule: ApprovalLevelRule;
  approvers: ApproverDraft[];
}

interface WorkflowFormState {
  name: string;
  description: string;
  isDefault: boolean;
  currency: Currency;
  minAmount: string;
  maxAmount: string;
  levels: LevelDraft[];
}

const APPROVER_ROLE_OPTIONS: readonly WorkspaceRole[] = [
  WorkspaceRole.Approver,
  WorkspaceRole.ProcurementManager,
  WorkspaceRole.Admin,
  WorkspaceRole.Owner,
].filter((role) => roleHasPermission(role, Permission.ApprovalsDecide));

let draftSequence = 0;

function nextKey(prefix: string): string {
  draftSequence += 1;
  return `${prefix}-${draftSequence}`;
}

function emptyApprover(): ApproverDraft {
  return {
    key: nextKey('approver'),
    assignmentType: ApproverAssignmentType.Role,
    memberId: '',
    role: WorkspaceRole.Approver,
  };
}

function emptyLevel(index: number): LevelDraft {
  return {
    key: nextKey('level'),
    name: index === 0 ? 'Manager approval' : `Approval level ${index + 1}`,
    completionRule: ApprovalLevelRule.AllRequired,
    approvers: [emptyApprover()],
  };
}

function emptyForm(): WorkflowFormState {
  return {
    name: '',
    description: '',
    isDefault: false,
    currency: Currency.USD,
    minAmount: '',
    maxAmount: '',
    levels: [emptyLevel(0)],
  };
}

function formFromWorkflow(workflow: ApprovalWorkflowDetail): WorkflowFormState {
  return {
    name: workflow.name,
    description: workflow.description ?? '',
    isDefault: workflow.isDefault,
    currency: workflow.currency,
    minAmount: workflow.minAmount ?? '',
    maxAmount: workflow.maxAmount ?? '',
    levels:
      workflow.levels.length > 0
        ? workflow.levels.map((level) => ({
            key: nextKey('level'),
            name: level.name,
            completionRule: level.completionRule,
            approvers:
              level.approvers.length > 0
                ? level.approvers.map((approver) => ({
                    key: nextKey('approver'),
                    assignmentType: approver.assignmentType,
                    memberId: approver.member?.id ?? '',
                    role: approver.role ?? WorkspaceRole.Approver,
                  }))
                : [emptyApprover()],
          }))
        : [emptyLevel(0)],
  };
}

function toPayload(form: WorkflowFormState): ApprovalWorkflowWriteRequest {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    isDefault: form.isDefault,
    currency: form.currency,
    minAmount: form.minAmount.trim() || null,
    maxAmount: form.maxAmount.trim() || null,
    levels: form.levels.map((level) => ({
      name: level.name.trim(),
      completionRule: level.completionRule,
      approvers: level.approvers.map((approver) =>
        approver.assignmentType === ApproverAssignmentType.Member
          ? { assignmentType: ApproverAssignmentType.Member, memberId: approver.memberId }
          : { assignmentType: ApproverAssignmentType.Role, role: approver.role },
      ),
    })),
  };
}

function memberName(member: WorkspaceMemberSummary): string {
  return `${member.firstName} ${member.lastName}`.trim();
}

function memberUnavailableReason(member: WorkspaceMemberSummary): string | null {
  if (member.status !== MembershipStatus.Active) {
    return 'suspended';
  }

  if (!roleHasPermission(member.role, Permission.ApprovalsDecide)) {
    return 'no approval permission';
  }

  return null;
}

function validateWorkflow(
  form: WorkflowFormState,
  members: readonly WorkspaceMemberSummary[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  const membersById = new Map(members.map((member) => [member.id, member]));

  if (!form.name.trim()) {
    errors.name = 'Enter a workflow name.';
  }

  const amountPattern = /^\d{1,12}(\.\d{1,2})?$/;

  for (const [key, label] of [
    ['minAmount', 'minimum'],
    ['maxAmount', 'maximum'],
  ] as const) {
    const value = form[key].trim();

    if (value && !amountPattern.test(value)) {
      errors[key] = `Enter a valid ${label} amount with up to two decimal places.`;
    }
  }

  if (
    !errors.minAmount &&
    !errors.maxAmount &&
    form.minAmount.trim() &&
    form.maxAmount.trim() &&
    Number(form.minAmount) > Number(form.maxAmount)
  ) {
    errors.maxAmount = 'The maximum amount must be greater than or equal to the minimum amount.';
  }

  if (form.levels.length === 0) {
    errors.levels = 'Add at least one approval level.';
  }

  form.levels.forEach((level, levelIndex) => {
    const prefix = `levels.${levelIndex}`;

    if (!level.name.trim()) {
      errors[`${prefix}.name`] = 'Enter a name for this level.';
    }

    if (level.approvers.length === 0) {
      errors[`${prefix}.approvers`] = 'Add at least one approver to this level.';
    }

    const seenMembers = new Set<string>();
    const seenRoles = new Set<string>();

    level.approvers.forEach((approver, approverIndex) => {
      const path = `${prefix}.approvers.${approverIndex}`;

      if (approver.assignmentType === ApproverAssignmentType.Member) {
        if (!approver.memberId) {
          errors[path] = 'Select a workspace member.';
          return;
        }

        const member = membersById.get(approver.memberId);

        if (!member) {
          errors[path] = 'This member is not part of the workspace.';
          return;
        }

        if (member.status !== MembershipStatus.Active) {
          errors[path] = 'Suspended members cannot be assigned as approvers.';
          return;
        }

        if (!roleHasPermission(member.role, Permission.ApprovalsDecide)) {
          errors[path] = 'This member does not hold approval permission in their current role.';
          return;
        }

        if (seenMembers.has(member.id)) {
          errors[path] = 'This person already appears in this level.';
          return;
        }

        seenMembers.add(member.id);
        return;
      }

      if (!roleHasPermission(approver.role, Permission.ApprovalsDecide)) {
        errors[path] = 'Select a role that can decide approvals.';
        return;
      }

      if (seenRoles.has(approver.role)) {
        errors[path] = 'This role already appears in this level.';
        return;
      }

      seenRoles.add(approver.role);
    });
  });

  return errors;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export default function ApprovalWorkflowEditorPage() {
  const { activeWorkspace, hasPermission } = useAuth();
  const workspaceId = activeWorkspace?.id;
  const canReadMembers = hasPermission(Permission.MembersRead);
  const canManage = hasPermission(Permission.ApprovalWorkflowsManage);
  const { workflowId } = useParams<{ workflowId: string }>();
  const isEdit = Boolean(workflowId);
  const navigate = useNavigate();
  const location = useLocation();

  const nameId = useId();
  const descriptionId = useId();
  const currencyId = useId();
  const minAmountId = useId();
  const maxAmountId = useId();

  const [workflow, setWorkflow] = useState<ApprovalWorkflowDetail | null>(null);
  const [form, setForm] = useState<WorkflowFormState>(() => emptyForm());
  const [members, setMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const [workflowLoading, setWorkflowLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reload, setReload] = useState(0);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ApprovalWorkflowPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [activateOnSave, setActivateOnSave] = useState(false);
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
    if (!workspaceId || !canReadMembers) {
      setMembers([]);
      setMembersLoading(false);
      return;
    }

    const controller = new AbortController();
    const workspaceIdValue = workspaceId;
    setMembersLoading(true);
    setMembersError(null);

    async function loadMembers(): Promise<void> {
      try {
        const firstPage = await fetchMembers(
          workspaceIdValue,
          { page: 1, pageSize: 100 },
          controller.signal,
        );
        const collected = [...firstPage.items];

        for (let page = 2; page <= firstPage.totalPages; page += 1) {
          if (controller.signal.aborted) {
            return;
          }

          const nextPage = await fetchMembers(
            workspaceIdValue,
            { page, pageSize: 100 },
            controller.signal,
          );
          collected.push(...nextPage.items);
        }

        if (!controller.signal.aborted) {
          setMembers(collected);
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setMembersError(messageFrom(caught));
        }
      } finally {
        if (!controller.signal.aborted) {
          setMembersLoading(false);
        }
      }
    }

    void loadMembers();

    return () => controller.abort();
  }, [workspaceId, canReadMembers]);

  useEffect(() => {
    if (!isEdit) {
      setWorkflowLoading(false);
      return;
    }

    if (!workspaceId || !workflowId) {
      setWorkflowLoading(false);
      return;
    }

    const controller = new AbortController();
    setWorkflowLoading(true);
    setLoadError(null);
    setNotFound(false);

    fetchApprovalWorkflow(workspaceId, workflowId, controller.signal)
      .then((result) => {
        setWorkflow(result);
        setForm(formFromWorkflow(result));
      })
      .catch((caught: unknown) => {
        if (isAbortError(caught)) {
          return;
        }

        if (caught instanceof ApiRequestError && caught.status === 404) {
          setNotFound(true);
          return;
        }

        setLoadError(messageFrom(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setWorkflowLoading(false);
        }
      });

    return () => controller.abort();
  }, [workspaceId, workflowId, isEdit, reload]);

  function mutate(updater: (current: WorkflowFormState) => WorkflowFormState): void {
    setForm(updater);
    setPreview(null);
    setPreviewError(null);
    setFieldErrors({});
    setFormError(null);
    setActivateOnSave(false);
  }

  function updateLevel(key: string, changes: Partial<LevelDraft>): void {
    mutate((current) => ({
      ...current,
      levels: current.levels.map((level) => (level.key === key ? { ...level, ...changes } : level)),
    }));
  }

  function updateApprover(
    levelKey: string,
    approverKey: string,
    changes: Partial<ApproverDraft>,
  ): void {
    mutate((current) => ({
      ...current,
      levels: current.levels.map((level) =>
        level.key === levelKey
          ? {
              ...level,
              approvers: level.approvers.map((approver) =>
                approver.key === approverKey ? { ...approver, ...changes } : approver,
              ),
            }
          : level,
      ),
    }));
  }

  function addLevel(): void {
    mutate((current) => ({
      ...current,
      levels: [...current.levels, emptyLevel(current.levels.length)],
    }));
  }

  function removeLevel(key: string): void {
    mutate((current) => ({
      ...current,
      levels:
        current.levels.length > 1
          ? current.levels.filter((level) => level.key !== key)
          : current.levels,
    }));
  }

  function moveLevel(key: string, direction: -1 | 1): void {
    mutate((current) => {
      const index = current.levels.findIndex((level) => level.key === key);
      const target = index + direction;

      if (index < 0 || target < 0 || target >= current.levels.length) {
        return current;
      }

      const levels = [...current.levels];
      const [level] = levels.splice(index, 1);

      if (!level) {
        return current;
      }

      levels.splice(target, 0, level);
      return { ...current, levels };
    });
  }

  function addApprover(levelKey: string): void {
    mutate((current) => ({
      ...current,
      levels: current.levels.map((level) =>
        level.key === levelKey
          ? { ...level, approvers: [...level.approvers, emptyApprover()] }
          : level,
      ),
    }));
  }

  function removeApprover(levelKey: string, approverKey: string): void {
    mutate((current) => ({
      ...current,
      levels: current.levels.map((level) =>
        level.key === levelKey && level.approvers.length > 1
          ? {
              ...level,
              approvers: level.approvers.filter((approver) => approver.key !== approverKey),
            }
          : level,
      ),
    }));
  }

  async function handlePreview(): Promise<void> {
    if (!workspaceId || previewBusy) {
      return;
    }

    const errors = validateWorkflow(form, members);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setPreview(null);
      setPreviewError('Resolve the highlighted configuration issues before previewing.');
      return;
    }

    setPreviewBusy(true);
    setPreviewError(null);
    setPreview(null);

    try {
      const result = await previewApprovalWorkflow(workspaceId, toPayload(form));
      setPreview(result);
    } catch (caught) {
      setPreviewError(messageFrom(caught));
      setFieldErrors(fieldErrorsFrom(caught));
    } finally {
      setPreviewBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!workspaceId || busy || !canManage) {
      return;
    }

    const errors = validateWorkflow(form, members);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Please correct the highlighted configuration before saving.');
      return;
    }

    setBusy(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const payload = toPayload(form);
      const saved =
        isEdit && workflowId
          ? await updateApprovalWorkflow(workspaceId, workflowId, payload)
          : await createApprovalWorkflow(workspaceId, payload);
      let activated = saved.isActive;

      if (activateOnSave && !saved.isDefault && !saved.isActive) {
        try {
          await activateApprovalWorkflow(workspaceId, saved.id);
          activated = true;
        } catch (caught) {
          navigate(`/settings/approval-workflows/${saved.id}/edit`, {
            replace: true,
            state: {
              notice: `“${saved.name}” was saved, but it could not be activated: ${messageFrom(
                caught,
              )}`,
            },
          });
          return;
        }
      }

      navigate('/settings/approval-workflows', {
        state: {
          notice: isEdit
            ? `“${saved.name}” was updated. In-progress approvals keep their original configuration.`
            : activated
              ? `“${saved.name}” was created and activated.`
              : `“${saved.name}” was created as an inactive workflow.`,
        },
      });
    } catch (caught) {
      setFormError(messageFrom(caught));
      setFieldErrors(fieldErrorsFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  const loading = workflowLoading || membersLoading;

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Settings · Approvals"
          title="Workflow configuration"
          description="Approval workflow administration is limited to workspace administrators and procurement managers."
          actions={
            <ButtonLink to="/settings/approval-workflows" variant="secondary" icon={ArrowLeft}>
              Back to workflows
            </ButtonLink>
          }
        />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="You cannot manage approval workflows"
            description="Your role can view workflows if permitted, but only workspace owners, administrators and procurement managers can change approval routing."
          />
        </Card>
      </div>
    );
  }

  if (loading) {
    return <PageSkeleton />;
  }

  if (notFound) {
    return (
      <div className="flex min-h-[52vh] items-center justify-center">
        <Card className="w-full max-w-xl">
          <EmptyState
            icon={GitBranch}
            title="Workflow not found"
            description="This workflow does not exist in the active workspace, or it may have been deleted."
            action={
              <ButtonLink to="/settings/approval-workflows" variant="primary" icon={ArrowLeft}>
                Back to workflows
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Settings · Approvals"
          title={isEdit ? 'Edit approval workflow' : 'New approval workflow'}
          description="Configure who reviews purchase requests, in what order, and which amount bands route here."
          actions={
            <ButtonLink to="/settings/approval-workflows" variant="secondary" icon={ArrowLeft}>
              Back to workflows
            </ButtonLink>
          }
        />
        <RequestErrorPanel message={loadError} onRetry={() => setReload((value) => value + 1)} />
      </div>
    );
  }

  const activationAvailable = !form.isDefault && (!workflow || !workflow.isActive);
  const canActivateAfterSave = activationAvailable && preview?.canActivate === true;

  return (
    <div className="space-y-6 lg:space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/settings/approval-workflows"
          className="inline-flex items-center gap-1.5 rounded-sm text-[11px] font-medium text-stone transition-colors hover:text-espresso"
        >
          <ArrowLeft size={13} strokeWidth={1.8} aria-hidden="true" />
          All approval workflows
        </Link>
        {workflow ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={
                workflow.isActive
                  ? 'rounded-full bg-[#edefe7] px-2.5 py-1 text-[9.5px] font-medium text-[#4f5b40]'
                  : 'rounded-full bg-[#f2efea] px-2.5 py-1 text-[9.5px] font-medium text-[#6f6258]'
              }
            >
              {workflow.isActive ? 'Active' : 'Inactive'}
            </span>
            {workflow.isDefault ? (
              <span className="rounded-full bg-[#f4eddf] px-2.5 py-1 text-[9.5px] font-medium text-[#6b5430]">
                Default workflow
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {notice ? (
        <RequestNotice tone="success" message={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      <PageHeader
        eyebrow="Settings · Approvals"
        title={isEdit ? 'Edit approval workflow' : 'New approval workflow'}
        description="Levels run in order. Steps within a level run in parallel, using the completion rule you choose. In-progress approvals keep the configuration captured when their cycle started."
      />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {formError ? (
          <RequestNotice tone="error" message={formError} onDismiss={() => setFormError(null)} />
        ) : null}

        {membersError ? (
          <RequestNotice
            tone="error"
            message={`Workspace members could not be loaded: ${membersError}. You can still assign roles.`}
          />
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:gap-5">
          <div className="space-y-4 xl:space-y-5">
            <Card className="overflow-hidden">
              <div className="border-b border-beige/70 px-5 py-4 sm:px-6">
                <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
                  Workflow details
                </h2>
                <p className="mt-1 text-[11.5px] leading-5 text-stone">
                  Name the workflow and limit the purchase requests it should route.
                </p>
              </div>

              <div className="space-y-4 px-5 py-5 sm:px-6">
                <Field label="Workflow name" htmlFor={nameId} error={fieldErrors.name} required>
                  <input
                    id={nameId}
                    type="text"
                    value={form.name}
                    onChange={(event) =>
                      mutate((current) => ({ ...current, name: event.target.value }))
                    }
                    maxLength={120}
                    placeholder="e.g. Standard procurement approval"
                    aria-invalid={fieldErrors.name ? true : undefined}
                    className={inputClassName(fieldErrors.name)}
                  />
                </Field>

                <Field label="Description" htmlFor={descriptionId} error={fieldErrors.description}>
                  <textarea
                    id={descriptionId}
                    value={form.description}
                    onChange={(event) =>
                      mutate((current) => ({ ...current, description: event.target.value }))
                    }
                    rows={3}
                    maxLength={2000}
                    placeholder="Explain when this workflow applies and who it is intended for."
                    aria-invalid={fieldErrors.description ? true : undefined}
                    className={textareaClassName(fieldErrors.description)}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    label="Currency"
                    htmlFor={currencyId}
                    error={fieldErrors.currency}
                    required
                  >
                    <select
                      id={currencyId}
                      value={form.currency}
                      onChange={(event) =>
                        mutate((current) => ({
                          ...current,
                          currency: event.target.value as Currency,
                        }))
                      }
                      className={inputClassName(fieldErrors.currency)}
                    >
                      {CURRENCY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="Minimum amount"
                    htmlFor={minAmountId}
                    error={fieldErrors.minAmount}
                    hint="Leave blank for no lower bound."
                  >
                    <input
                      id={minAmountId}
                      type="text"
                      inputMode="decimal"
                      value={form.minAmount}
                      onChange={(event) =>
                        mutate((current) => ({ ...current, minAmount: event.target.value }))
                      }
                      placeholder="0.00"
                      aria-invalid={fieldErrors.minAmount ? true : undefined}
                      className={inputClassName(fieldErrors.minAmount)}
                    />
                  </Field>

                  <Field
                    label="Maximum amount"
                    htmlFor={maxAmountId}
                    error={fieldErrors.maxAmount}
                    hint="Leave blank for no upper bound."
                  >
                    <input
                      id={maxAmountId}
                      type="text"
                      inputMode="decimal"
                      value={form.maxAmount}
                      onChange={(event) =>
                        mutate((current) => ({ ...current, maxAmount: event.target.value }))
                      }
                      placeholder="25000.00"
                      aria-invalid={fieldErrors.maxAmount ? true : undefined}
                      className={inputClassName(fieldErrors.maxAmount)}
                    />
                  </Field>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-beige bg-ivory/40 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(event) =>
                      mutate((current) => ({ ...current, isDefault: event.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-beige text-espresso accent-espresso"
                  />
                  <span>
                    <span className="block text-[11.5px] font-medium text-espresso">
                      Use as the workspace default
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-taupe">
                      The default workflow handles matching requests before amount-specific
                      workflows. Saving a default workflow activates it and clears the previous
                      default.
                    </span>
                  </span>
                </label>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-beige/70 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
                    Approval levels
                  </h2>
                  <p className="mt-1 max-w-xl text-[11.5px] leading-5 text-stone">
                    Levels run sequentially. Within each level, every assigned approver can act in
                    parallel and the completion rule decides when the level is satisfied.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addLevel}
                  disabled={form.levels.length >= 10}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-beige bg-white px-3.5 text-[12px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={14} aria-hidden="true" />
                  Add level
                </button>
              </div>

              {fieldErrors.levels ? (
                <p className="border-b border-beige/60 px-5 py-3 text-[10px] leading-4 text-clay sm:px-6">
                  {fieldErrors.levels}
                </p>
              ) : null}

              <div className="divide-y divide-beige/60">
                {form.levels.map((level, levelIndex) => {
                  const prefix = `levels.${levelIndex}`;

                  return (
                    <div key={level.key} className="px-5 py-5 sm:px-6">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-full border border-beige bg-white text-[9.5px] font-semibold text-stone">
                            {levelIndex + 1}
                          </span>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-taupe">
                            Level {levelIndex + 1}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveLevel(level.key, -1)}
                            disabled={levelIndex === 0}
                            aria-label={`Move level ${levelIndex + 1} up`}
                            className="grid h-8 w-8 place-items-center rounded-lg text-stone transition-colors hover:bg-ivory hover:text-espresso disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ArrowUp size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLevel(level.key, 1)}
                            disabled={levelIndex === form.levels.length - 1}
                            aria-label={`Move level ${levelIndex + 1} down`}
                            className="grid h-8 w-8 place-items-center rounded-lg text-stone transition-colors hover:bg-ivory hover:text-espresso disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ArrowDown size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLevel(level.key)}
                            disabled={form.levels.length === 1}
                            aria-label={`Remove level ${levelIndex + 1}`}
                            className="grid h-8 w-8 place-items-center rounded-lg text-clay transition-colors hover:bg-[#f5e7e2] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field
                          label="Level name"
                          htmlFor={`${level.key}-name`}
                          error={fieldErrors[`${prefix}.name`]}
                          required
                        >
                          <input
                            id={`${level.key}-name`}
                            type="text"
                            value={level.name}
                            onChange={(event) =>
                              updateLevel(level.key, { name: event.target.value })
                            }
                            maxLength={140}
                            placeholder="e.g. Finance review"
                            aria-invalid={fieldErrors[`${prefix}.name`] ? true : undefined}
                            className={inputClassName(fieldErrors[`${prefix}.name`])}
                          />
                        </Field>

                        <Field
                          label="Completion rule"
                          htmlFor={`${level.key}-rule`}
                          error={fieldErrors[`${prefix}.completionRule`]}
                          required
                        >
                          <select
                            id={`${level.key}-rule`}
                            value={level.completionRule}
                            onChange={(event) =>
                              updateLevel(level.key, {
                                completionRule: event.target.value as ApprovalLevelRule,
                              })
                            }
                            className={inputClassName(fieldErrors[`${prefix}.completionRule`])}
                          >
                            <option value={ApprovalLevelRule.AllRequired}>
                              All required — every approver must approve
                            </option>
                            <option value={ApprovalLevelRule.AnyOne}>
                              Any one — a single approval completes the level
                            </option>
                          </select>
                        </Field>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-stone">
                            Approvers
                          </p>
                          <button
                            type="button"
                            onClick={() => addApprover(level.key)}
                            disabled={level.approvers.length >= 20}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-beige bg-white px-2.5 text-[10.5px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Plus size={12} aria-hidden="true" />
                            Add approver
                          </button>
                        </div>

                        {fieldErrors[`${prefix}.approvers`] ? (
                          <p className="mb-2 text-[10px] leading-4 text-clay">
                            {fieldErrors[`${prefix}.approvers`]}
                          </p>
                        ) : null}

                        <div className="space-y-2">
                          {level.approvers.map((approver, approverIndex) => {
                            const path = `${prefix}.approvers.${approverIndex}`;

                            return (
                              <div
                                key={approver.key}
                                className="rounded-xl border border-beige/80 bg-ivory/20 px-3 py-2.5"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <select
                                    aria-label={`Assignment type for level ${levelIndex + 1} approver ${approverIndex + 1}`}
                                    value={approver.assignmentType}
                                    onChange={(event) => {
                                      const assignmentType = event.target
                                        .value as ApproverAssignmentType;

                                      updateApprover(level.key, approver.key, {
                                        assignmentType,
                                        memberId: '',
                                        role: WorkspaceRole.Approver,
                                      });
                                    }}
                                    className="h-9 rounded-lg border border-beige bg-white px-2 text-[11px] text-espresso outline-none focus:border-taupe focus:ring-2 focus:ring-taupe/15"
                                  >
                                    <option value={ApproverAssignmentType.Member}>Member</option>
                                    <option value={ApproverAssignmentType.Role}>Role</option>
                                  </select>

                                  {approver.assignmentType === ApproverAssignmentType.Member ? (
                                    <select
                                      aria-label={`Member for level ${levelIndex + 1} approver ${approverIndex + 1}`}
                                      value={approver.memberId}
                                      onChange={(event) =>
                                        updateApprover(level.key, approver.key, {
                                          memberId: event.target.value,
                                        })
                                      }
                                      className="h-9 min-w-0 flex-1 rounded-lg border border-beige bg-white px-2 text-[11px] text-espresso outline-none focus:border-taupe focus:ring-2 focus:ring-taupe/15"
                                    >
                                      <option value="">Select a workspace member</option>
                                      {members.map((member) => {
                                        const reason = memberUnavailableReason(member);

                                        return (
                                          <option
                                            key={member.id}
                                            value={member.id}
                                            disabled={reason !== null}
                                          >
                                            {memberName(member)} — {ROLE_LABELS[member.role]}
                                            {reason ? ` (${reason})` : ''}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  ) : (
                                    <select
                                      aria-label={`Role for level ${levelIndex + 1} approver ${approverIndex + 1}`}
                                      value={approver.role}
                                      onChange={(event) =>
                                        updateApprover(level.key, approver.key, {
                                          role: event.target.value as WorkspaceRole,
                                        })
                                      }
                                      className="h-9 min-w-0 flex-1 rounded-lg border border-beige bg-white px-2 text-[11px] text-espresso outline-none focus:border-taupe focus:ring-2 focus:ring-taupe/15"
                                    >
                                      {APPROVER_ROLE_OPTIONS.map((role) => (
                                        <option key={role} value={role}>
                                          {ROLE_LABELS[role]}
                                        </option>
                                      ))}
                                    </select>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => removeApprover(level.key, approver.key)}
                                    disabled={level.approvers.length === 1}
                                    aria-label={`Remove level ${levelIndex + 1} approver ${approverIndex + 1}`}
                                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-clay transition-colors hover:bg-[#f5e7e2] disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <Trash2 size={13} aria-hidden="true" />
                                  </button>
                                </div>

                                {approver.assignmentType === ApproverAssignmentType.Role ? (
                                  <p className="mt-1.5 text-[9.5px] leading-4 text-taupe">
                                    Expands to every active member holding this role when a request
                                    is submitted. The requester is excluded automatically.
                                  </p>
                                ) : null}

                                {fieldErrors[path] ? (
                                  <p className="mt-1.5 text-[10px] leading-4 text-clay">
                                    {fieldErrors[path]}
                                  </p>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start xl:space-y-5">
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-beige/70 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
                    Configuration preview
                  </h2>
                  <p className="mt-1 text-[11px] leading-5 text-stone">
                    Resolve roles and validate approvers before saving or activating.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handlePreview()}
                  disabled={previewBusy}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-beige bg-white px-2.5 text-[10.5px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6] disabled:cursor-wait disabled:opacity-60"
                >
                  {previewBusy ? (
                    <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Users size={12} strokeWidth={1.8} aria-hidden="true" />
                  )}
                  Preview
                </button>
              </div>

              <div className="space-y-3 px-5 py-5 sm:px-6">
                {previewError ? (
                  <p
                    role="alert"
                    className="rounded-xl border border-clay/25 bg-[#f5e7e2] px-3 py-2.5 text-[10.5px] leading-4 text-[#8a4a3b]"
                  >
                    {previewError}
                  </p>
                ) : null}

                {!preview && !previewError ? (
                  <p className="text-[11px] leading-5 text-stone">
                    Preview checks each level, resolves role assignments against active members and
                    shows who would receive the approval. Any change to the configuration clears the
                    preview.
                  </p>
                ) : null}

                {preview ? (
                  <>
                    <div
                      className={
                        preview.canActivate
                          ? 'flex items-start gap-2 rounded-xl border border-sage/25 bg-[#edefe7] px-3 py-2.5 text-[10.5px] leading-4 text-[#4f5b40]'
                          : 'flex items-start gap-2 rounded-xl border border-ochre/30 bg-[#f5ebdd] px-3 py-2.5 text-[10.5px] leading-4 text-[#7a5a35]'
                      }
                    >
                      {preview.canActivate ? (
                        <CheckCircle2 size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                      )}
                      <p>
                        {preview.canActivate
                          ? 'This configuration is ready to activate.'
                          : 'Resolve the warnings before this workflow can be activated.'}
                      </p>
                    </div>

                    <ol className="space-y-2.5">
                      {preview.levels.map((level) => (
                        <li
                          key={level.levelOrder}
                          className="rounded-xl border border-beige bg-white px-3 py-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-medium text-espresso">
                              {level.levelOrder}. {level.name || 'Unnamed level'}
                            </p>
                            <span className="rounded-full border border-beige bg-ivory/60 px-2 py-0.5 text-[8.5px] font-medium text-taupe">
                              {level.completionRule === ApprovalLevelRule.AnyOne
                                ? 'Any one'
                                : 'All required'}
                            </span>
                          </div>
                          <p className="mt-1 text-[9.5px] leading-4 text-stone">
                            {level.approvers.length > 0
                              ? level.approvers
                                  .map((approver) =>
                                    `${approver.firstName} ${approver.lastName}`.trim(),
                                  )
                                  .join(', ')
                              : 'No eligible approvers'}
                          </p>
                          {level.warnings.length > 0 ? (
                            <ul className="mt-1.5 space-y-1">
                              {level.warnings.map((warning) => (
                                <li key={warning} className="text-[9.5px] leading-4 text-[#8a4a3b]">
                                  {warning}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ol>

                    {preview.warnings.length > 0 ? (
                      <div className="rounded-xl border border-ochre/25 bg-[#f5ebdd]/60 px-3 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7a5a35]">
                          Warnings
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {[...new Set(preview.warnings)].map((warning) => (
                            <li key={warning} className="text-[10px] leading-4 text-[#7a5a35]">
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </Card>

            {activationAvailable ? (
              <Card className="overflow-hidden">
                <div className="px-5 py-4 sm:px-6">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={activateOnSave}
                      disabled={!canActivateAfterSave}
                      onChange={(event) => setActivateOnSave(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-beige text-espresso accent-espresso disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <span>
                      <span className="block text-[11.5px] font-medium text-espresso">
                        Activate after saving
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-taupe">
                        {canActivateAfterSave
                          ? 'The workflow becomes available for matching requests immediately after it is saved.'
                          : 'Preview a valid configuration first to enable activation.'}
                      </span>
                    </span>
                  </label>
                </div>
              </Card>
            ) : null}

            <Card className="overflow-hidden">
              <div className="border-b border-beige/70 px-5 py-4 sm:px-6">
                <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
                  Routing behavior
                </h2>
              </div>
              <div className="space-y-2.5 px-5 py-5 text-[10.5px] leading-5 text-stone sm:px-6">
                <p>
                  A workflow is selected by currency and request total. The default workflow wins;
                  otherwise the most specific minimum amount wins.
                </p>
                <p>
                  Two equally specific active workflows without a default are rejected as ambiguous,
                  so requesters get a clear error instead of an unpredictable route.
                </p>
                <p>
                  Each submission snapshots the workflow name, levels, rules and assigned approvers.
                  Editing this configuration never changes an approval already in progress.
                </p>
              </div>
            </Card>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            to="/settings/approval-workflows"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-beige bg-white px-4 text-[13px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6]"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => void handlePreview()}
            disabled={previewBusy || busy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-beige bg-white px-4 text-[13px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6] disabled:cursor-wait disabled:opacity-60"
          >
            {previewBusy ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Users size={15} strokeWidth={1.8} aria-hidden="true" />
            )}
            Preview
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-espresso px-4 text-[13px] font-medium text-ivory shadow-[0_1px_2px_rgba(56,44,39,0.18)] transition-colors hover:bg-espresso-light disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Save size={15} aria-hidden="true" />
            )}
            {isEdit ? 'Save changes' : 'Create workflow'}
          </button>
        </div>
      </form>
    </div>
  );
}

function inputClassName(error?: string): string {
  return `h-10 w-full rounded-xl border bg-white px-3 text-[12.5px] text-espresso outline-none transition-colors placeholder:text-taupe/70 focus:ring-2 ${
    error
      ? 'border-clay/60 focus:border-clay focus:ring-clay/15'
      : 'border-beige hover:border-taupe/50 focus:border-taupe focus:ring-taupe/15'
  }`;
}

function textareaClassName(error?: string): string {
  return `w-full rounded-xl border bg-white px-3 py-2.5 text-[12.5px] leading-6 text-espresso outline-none transition-colors placeholder:text-taupe/70 focus:ring-2 ${
    error
      ? 'border-clay/60 focus:border-clay focus:ring-clay/15'
      : 'border-beige hover:border-taupe/50 focus:border-taupe focus:ring-taupe/15'
  }`;
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

function Field({ label, htmlFor, error, hint, required = false, children }: FieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-stone"
      >
        {label}
        {required ? <span className="ml-1 text-clay">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[10px] leading-4 text-clay">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[10px] leading-4 text-taupe">{hint}</p>
      ) : null}
    </div>
  );
}
