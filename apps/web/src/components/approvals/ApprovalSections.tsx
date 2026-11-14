import {
  ApprovalCycleStatus,
  ApprovalLevelRule,
  ApprovalStepStatus,
  ApproverAssignmentType,
} from '@procureflow/shared';
import type { ApprovalCycleSummary, ApprovalLevelRecord } from '@procureflow/shared';
import { Check, CheckCircle2, Circle, GitBranch, MessageSquareText, Undo2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatSubmissionTime } from '../../lib/format';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';

interface ApprovalProgressProps {
  approval: ApprovalCycleSummary;
  action?: ReactNode;
}

/**
 * Compact level-by-level progress for an approval cycle. The cycle snapshot is
 * shown instead of the live workflow so completed approvals remain accurate.
 */
export function ApprovalProgress({ approval, action }: ApprovalProgressProps) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-beige/70 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
              Approval progress
            </h2>
            <p className="mt-1 text-[11px] leading-5 text-stone">
              {approval.workflowName ?? 'Workflow snapshot'} · {approval.levelCount}{' '}
              {approval.levelCount === 1 ? 'level' : 'levels'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-beige bg-ivory/60 px-2.5 py-1 text-[10px] font-medium text-stone">
              <GitBranch size={11} strokeWidth={1.8} aria-hidden="true" />
              {approval.status === ApprovalCycleStatus.Pending
                ? `Level ${approval.currentLevel} of ${approval.levelCount}`
                : approval.status.replaceAll('_', ' ')}
            </span>
            {action}
          </div>
        </div>
      </div>

      <ol className="grid gap-3 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        {approval.levels.map((level) => (
          <li
            key={level.levelOrder}
            className={
              level.levelOrder === approval.currentLevel &&
              approval.status === ApprovalCycleStatus.Pending
                ? 'rounded-xl border border-ochre/40 bg-[#fbf7ef] px-3.5 py-3'
                : 'rounded-xl border border-beige bg-white px-3.5 py-3'
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <LevelIcon status={level.status} />
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-taupe">
                    Level {level.levelOrder}
                  </p>
                  <p className="mt-0.5 text-[11.5px] font-medium text-espresso">{level.name}</p>
                </div>
              </div>
              <StatusBadge status={level.status} />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[9.5px] text-taupe">
              {level.completionRule === ApprovalLevelRule.AnyOne
                ? 'Any one approver completes this level'
                : 'All approvers must approve'}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

interface ApprovalLevelsProps {
  approval: ApprovalCycleSummary;
  title?: string;
  description?: string;
}

/** The full approval-step snapshot, including prior decisions and comments. */
export function ApprovalLevels({
  approval,
  title = 'Approval steps',
  description = 'The configuration snapshot captured when this cycle started. Later workflow edits do not change this approval.',
}: ApprovalLevelsProps) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-beige/70 px-5 py-4 sm:px-6">
        <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">{title}</h2>
        <p className="mt-1 text-[11.5px] leading-5 text-stone">{description}</p>
      </div>

      <div className="divide-y divide-beige/60">
        {approval.levels.map((level) => (
          <ApprovalLevel
            key={level.levelOrder}
            level={level}
            isCurrent={
              level.levelOrder === approval.currentLevel &&
              approval.status === ApprovalCycleStatus.Pending
            }
          />
        ))}
      </div>
    </Card>
  );
}

interface ApprovalHistoryProps {
  history: ApprovalCycleSummary[];
  currentCycle: number;
}

/** Every cycle for a purchase request, newest first, with preserved decisions. */
export function ApprovalHistory({ history, currentCycle }: ApprovalHistoryProps) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-beige/70 px-5 py-4 sm:px-6">
        <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
          Cycle history
        </h2>
        <p className="mt-1 text-[11.5px] leading-5 text-stone">
          Every submission creates a new cycle. Earlier decisions remain preserved for audit.
        </p>
      </div>

      <ol className="divide-y divide-beige/60">
        {history.map((cycle) => (
          <li key={cycle.id} className="px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11.5px] font-semibold text-espresso">
                  Cycle {cycle.cycleNumber}
                  {cycle.cycleNumber === currentCycle ? ' · Current' : ''}
                </p>
                <p className="mt-0.5 text-[9.5px] text-taupe">
                  {cycle.workflowName ?? 'Workflow snapshot'} · Started{' '}
                  {formatSubmissionTime(cycle.requestedAt)}
                  {cycle.completedAt
                    ? ` · Completed ${formatSubmissionTime(cycle.completedAt)}`
                    : ''}
                </p>
              </div>
              <StatusBadge status={cycle.status} />
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {cycle.levels.flatMap((level) =>
                level.steps.map((step) => (
                  <span
                    key={step.id}
                    className="inline-flex items-center gap-1 rounded-full border border-beige bg-white px-2 py-1 text-[9px] text-stone"
                  >
                    <span className="font-medium text-espresso">
                      {step.approver
                        ? `${step.approver.firstName} ${step.approver.lastName}`.trim()
                        : 'Approver'}
                    </span>
                    <StatusBadge status={step.status} />
                  </span>
                )),
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function ApprovalLevel({ level, isCurrent }: { level: ApprovalLevelRecord; isCurrent: boolean }) {
  return (
    <div className={isCurrent ? 'bg-ivory/20 px-5 py-4 sm:px-6' : 'px-5 py-4 sm:px-6'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full border border-beige bg-white text-[9.5px] font-semibold text-stone">
            {level.levelOrder}
          </span>
          <h3 className="text-[12px] font-semibold text-espresso">{level.name}</h3>
          <span className="rounded-full border border-beige bg-white px-2 py-0.5 text-[9px] font-medium text-taupe">
            {level.completionRule === ApprovalLevelRule.AnyOne ? 'Any one' : 'All required'}
          </span>
          {isCurrent ? (
            <span className="rounded-full bg-[#f4eddf] px-2 py-0.5 text-[9px] font-medium text-[#6b5430]">
              Current level
            </span>
          ) : null}
        </div>
        <StatusBadge status={level.status} />
      </div>

      <ul className="mt-3 space-y-2">
        {level.steps.map((step) => (
          <li
            key={step.id}
            className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-beige/80 bg-white px-3 py-2.5"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <StepIcon status={step.status} />
              <div className="min-w-0">
                <p className="text-[11.5px] font-medium text-espresso">
                  {step.approver
                    ? `${step.approver.firstName} ${step.approver.lastName}`.trim()
                    : 'Approver unavailable'}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[9.5px] text-taupe">
                  {step.approver?.jobTitle ? <span>{step.approver.jobTitle}</span> : null}
                  {step.assignmentType === ApproverAssignmentType.Role && step.assignedRole ? (
                    <span>· Assigned by role: {step.assignedRole.replaceAll('_', ' ')}</span>
                  ) : null}
                  {step.decidedAt ? (
                    <span>· {formatSubmissionTime(step.decidedAt)}</span>
                  ) : step.isActive ? (
                    <span>· Awaiting decision</span>
                  ) : null}
                </p>
                {step.decisionNote ? (
                  <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-ivory/60 px-2 py-1.5 text-[10px] leading-4 text-stone">
                    <MessageSquareText
                      size={11}
                      className="mt-0.5 shrink-0 text-taupe"
                      aria-hidden="true"
                    />
                    {step.decisionNote}
                  </p>
                ) : null}
              </div>
            </div>
            <StatusBadge status={step.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function LevelIcon({ status }: { status: ApprovalStepStatus }) {
  if (status === ApprovalStepStatus.Approved) {
    return <CheckCircle2 size={18} className="text-[#4f5b40]" aria-hidden="true" />;
  }

  if (status === ApprovalStepStatus.Rejected) {
    return <X size={18} className="text-clay" aria-hidden="true" />;
  }

  if (status === ApprovalStepStatus.ChangesRequested) {
    return <Undo2 size={18} className="text-[#7a5a35]" aria-hidden="true" />;
  }

  return <Circle size={18} className="text-taupe" aria-hidden="true" />;
}

function StepIcon({ status }: { status: ApprovalStepStatus }) {
  const config: Record<ApprovalStepStatus, { icon: LucideIcon; className: string }> = {
    [ApprovalStepStatus.Pending]: { icon: Circle, className: 'text-taupe' },
    [ApprovalStepStatus.Approved]: { icon: CheckCircle2, className: 'text-[#4f5b40]' },
    [ApprovalStepStatus.Rejected]: { icon: X, className: 'text-clay' },
    [ApprovalStepStatus.ChangesRequested]: { icon: Undo2, className: 'text-[#7a5a35]' },
    [ApprovalStepStatus.Cancelled]: { icon: Circle, className: 'text-taupe/60' },
    [ApprovalStepStatus.Skipped]: { icon: Check, className: 'text-taupe/60' },
  };
  const Icon = config[status].icon;

  return (
    <Icon size={14} strokeWidth={1.9} className={config[status].className} aria-hidden="true" />
  );
}

export function latestDecisionNote(approval: ApprovalCycleSummary | null): string | null {
  if (!approval) {
    return null;
  }

  const decided = approval.levels
    .flatMap((level) => level.steps)
    .filter(
      (step) =>
        step.decisionNote !== null &&
        step.status !== ApprovalStepStatus.Pending &&
        step.status !== ApprovalStepStatus.Cancelled &&
        step.status !== ApprovalStepStatus.Skipped,
    )
    .sort((left, right) => {
      const leftTime = left.decidedAt ? new Date(left.decidedAt).getTime() : 0;
      const rightTime = right.decidedAt ? new Date(right.decidedAt).getTime() : 0;
      return rightTime - leftTime;
    });

  return decided[0]?.decisionNote ?? null;
}
