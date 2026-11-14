import { ApprovalCycleStatus, ApprovalStepStatus, Priority } from '@procureflow/shared';
import type { ApprovalCycleSummary, ApprovalDetail } from '@procureflow/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { createFetchMock, createTestApprovals } from './api-mock';

function renderApp(initialEntries: string[] = ['/approvals']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );
}

/**
 * Builds a page of assigned approvals so inbox filtering and pagination can be
 * exercised without depending on the seed data.
 */
function approvalBatch(count: number): ApprovalDetail[] {
  const base = createTestApprovals()[0];

  if (!base) {
    return [];
  }

  const { request: _request, actions: _actions, history: _history, ...baseSummary } = base;

  return Array.from({ length: count }, (_, index) => {
    const priority = index % 2 === 0 ? Priority.High : Priority.Low;
    const submittedAt = `2026-11-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`;
    const levels = base.levels.map((level) => ({
      ...level,
      steps: level.steps.map((step) => ({
        ...step,
        id: `${step.id}-${index + 1}`,
      })),
    }));
    const summary: ApprovalCycleSummary = {
      ...baseSummary,
      id: `approval-batch-${index + 1}`,
      cycleNumber: 1,
      status: ApprovalCycleStatus.Pending,
      currentLevel: 1,
      requestedAt: submittedAt,
      completedAt: null,
      levels,
    };
    const request = {
      ...base.request,
      id: `request-batch-${index + 1}`,
      requestNumber: `PR-2026-${String(index + 10).padStart(4, '0')}`,
      title: `Approval request ${index + 1}`,
      priority,
      totalAmount: (1000 + index).toFixed(2),
      submittedAt,
      approval: summary,
      approvalHistory: [summary],
    };

    return {
      ...summary,
      request,
      actions: {
        ...base.actions,
        assignedStepId: levels[0]?.steps[0]?.id ?? null,
      },
      history: [summary],
    };
  });
}

describe('approval inbox', () => {
  it('lists assigned approvals with summary metrics and pagination', async () => {
    vi.stubGlobal('fetch', createFetchMock({ approvals: approvalBatch(11) }));

    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Approval inbox', level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Approval request 1')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–10 of 11 approvals')).toBeInTheDocument();
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Changes requested').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Next approval page' }));

    expect(await screen.findByText('Approval request 11')).toBeInTheDocument();
    expect(screen.getByText('Showing 11–11 of 11 approvals')).toBeInTheDocument();
    expect(screen.queryByText('Approval request 1')).not.toBeInTheDocument();
  });

  it('filters by status, priority and amount', async () => {
    vi.stubGlobal('fetch', createFetchMock({ approvals: approvalBatch(4) }));

    renderApp();
    await screen.findByText('Approval request 1');

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by approval status' }), {
      target: { value: ApprovalStepStatus.Approved },
    });

    expect(await screen.findByText('No approvals match these filters')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Clear filters/ }));

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by priority' }), {
      target: { value: Priority.Low },
    });

    await waitFor(() => expect(screen.queryByText('Approval request 1')).not.toBeInTheDocument());
    expect(screen.getByText('Approval request 2')).toBeInTheDocument();
    expect(screen.getByText('Approval request 4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More filters' }));
    fireEvent.change(screen.getByLabelText('Minimum amount'), {
      target: { value: '1002' },
    });

    await waitFor(() => expect(screen.queryByText('Approval request 2')).not.toBeInTheDocument());
    expect(screen.getByText('Approval request 4')).toBeInTheDocument();
  });

  it('filters by requester and submitted date range', async () => {
    vi.stubGlobal('fetch', createFetchMock({ approvals: approvalBatch(11) }));

    renderApp();
    await screen.findByText('Approval request 1');

    fireEvent.click(screen.getByRole('button', { name: 'More filters' }));
    fireEvent.change(screen.getByLabelText('Submitted from'), {
      target: { value: '2026-11-09' },
    });

    await waitFor(() => expect(screen.queryByText('Approval request 1')).not.toBeInTheDocument());
    expect(screen.getByText('Approval request 9')).toBeInTheDocument();
    expect(screen.getByText('Approval request 11')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by requester'), {
      target: { value: 'Sofia Lindberg' },
    });

    expect(await screen.findByText('No approvals match these filters')).toBeInTheDocument();
  });
});

describe('approval detail decisions', () => {
  it('records an approval and advances to the next level', async () => {
    renderApp(['/approvals/approval-pending-1']);

    expect(
      await screen.findByRole('heading', { name: 'Annual safety supplies', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Approval progress')).toBeInTheDocument();
    expect(screen.getByText('Approval steps')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Approve this request?')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: 'Approved against the operations budget.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve request' }));

    expect(
      await screen.findByText('Your approval was recorded. PR-2026-0002 is now at level 2.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Level 2 of 2').length).toBeGreaterThan(0);
    expect(screen.getByText('Approved against the operations budget.')).toBeInTheDocument();
    expect(screen.getAllByText('Priya Nair').length).toBeGreaterThan(0);
  });

  it('requires a rejection reason and records the rejection', async () => {
    renderApp(['/approvals/approval-pending-1']);

    await screen.findByRole('heading', { name: 'Annual safety supplies', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Reject this request?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject request' }));

    expect(
      await within(dialog).findByText('Enter a reason for rejecting this request.'),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: 'Budget is frozen for the remainder of the quarter.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject request' }));

    expect(
      await screen.findByText('PR-2026-0002 was rejected and returned to the requester.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Budget is frozen for the remainder of the quarter.'),
    ).toBeInTheDocument();
    expect(screen.getByText('This approval cycle is no longer pending.')).toBeInTheDocument();
  });

  it('requires an explanation before requesting changes', async () => {
    renderApp(['/approvals/approval-pending-1']);

    await screen.findByRole('heading', { name: 'Annual safety supplies', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Request changes' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Request changes?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Request changes' }));

    expect(
      await within(dialog).findByText('Explain the changes the requester needs to make.'),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: 'Attach two comparable vendor quotes before resubmitting.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Request changes' }));

    expect(
      await screen.findByText('PR-2026-0002 was returned to the requester for changes.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Attach two comparable vendor quotes before resubmitting.'),
    ).toBeInTheDocument();
    expect(screen.getByText('This approval cycle is no longer pending.')).toBeInTheDocument();
  });
});
