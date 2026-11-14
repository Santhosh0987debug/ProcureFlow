import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../App';

function renderApp(initialEntries: string[] = ['/settings/approval-workflows']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );
}

describe('approval workflow configuration', () => {
  it('lists workflows with activation state and filters by status', async () => {
    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Approval workflows', level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Standard procurement approval')).toBeInTheDocument();
    expect(screen.getByText('Capital expenditure approval')).toBeInTheDocument();
    expect(screen.getByText('Low-value fast track')).toBeInTheDocument();
    expect(screen.getAllByText('Default').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'New workflow' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter workflows by status' }), {
      target: { value: 'inactive' },
    });

    await waitFor(() =>
      expect(screen.queryByText('Standard procurement approval')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Low-value fast track')).toBeInTheDocument();
  });

  it('activates an inactive workflow from the list', async () => {
    renderApp();
    await screen.findByText('Low-value fast track');

    const row = screen.getByText('Low-value fast track').closest('li');

    if (!row) {
      throw new Error('Workflow row was not rendered.');
    }

    fireEvent.click(within(row).getByRole('button', { name: 'Activate' }));

    expect(await screen.findByText('“Low-value fast track” is now active.')).toBeInTheDocument();

    await waitFor(() => {
      const updatedRow = screen.getByText('Low-value fast track').closest('li');

      if (!updatedRow) {
        throw new Error('Workflow row was not rendered after activation.');
      }

      expect(within(updatedRow).getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    });
  });

  it('validates, previews and activates a new workflow', async () => {
    renderApp(['/settings/approval-workflows/new']);

    expect(
      await screen.findByRole('heading', { name: 'New approval workflow', level: 1 }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[0] as HTMLElement);

    expect(await screen.findByText('Enter a workflow name.')).toBeInTheDocument();
    expect(
      screen.getByText('Resolve the highlighted configuration issues before previewing.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Workflow name/), {
      target: { value: 'Test workflow' },
    });
    fireEvent.change(screen.getByLabelText(/Minimum amount/), {
      target: { value: '5000' },
    });
    fireEvent.change(screen.getByLabelText(/Maximum amount/), {
      target: { value: '10000' },
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[0] as HTMLElement);

    expect(await screen.findByText('This configuration is ready to activate.')).toBeInTheDocument();
    expect(screen.getAllByText('Priya Nair').length).toBeGreaterThan(0);

    const activate = screen.getByRole('checkbox', { name: /Activate after saving/ });
    expect(activate).not.toBeDisabled();
    fireEvent.click(activate);

    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: 'A preview-gated test workflow.' },
    });

    expect(screen.queryByText('This configuration is ready to activate.')).not.toBeInTheDocument();
    expect(activate).toBeDisabled();

    fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[0] as HTMLElement);
    await screen.findByText('This configuration is ready to activate.');

    fireEvent.click(screen.getByRole('checkbox', { name: /Activate after saving/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create workflow' }));

    expect(
      await screen.findByText('“Test workflow” was created and activated.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Test workflow')).toBeInTheDocument();
  });

  it('edits an existing workflow and keeps in-progress approvals on their snapshot', async () => {
    renderApp(['/settings/approval-workflows/workflow-fast-track/edit']);

    expect(
      await screen.findByRole('heading', { name: 'Edit approval workflow', level: 1 }),
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Workflow name/);
    expect(nameInput).toHaveValue('Low-value fast track');

    fireEvent.change(nameInput, { target: { value: 'Low-value fast track v2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(
        '“Low-value fast track v2” was updated. In-progress approvals keep their original configuration.',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('Low-value fast track v2')).toBeInTheDocument();
  });
});
