import { Currency, RequestStatus, WorkspaceRole } from '@procureflow/shared';
import type { PurchaseRequestDetail } from '@procureflow/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { createFetchMock, createTestPurchaseRequests, createTestSession } from './api-mock';

function renderApp(initialEntries: string[] = ['/purchase-requests']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );
}

function futureDate(days = 30): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('purchase requests workspace', () => {
  it('lists requests with summary metrics and filters by search and status', async () => {
    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Purchase Requests', level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Office equipment refresh')).toBeInTheDocument();
    expect(screen.getByText('Annual safety supplies')).toBeInTheDocument();
    expect(screen.getByText('PR-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('PR-2026-0002')).toBeInTheDocument();
    expect(screen.getByText('Total requests')).toBeInTheDocument();
    expect(screen.getByText('Drafts')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /New request/ })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search purchase requests' }), {
      target: { value: 'safety' },
    });

    await waitFor(() =>
      expect(screen.queryByText('Office equipment refresh')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Annual safety supplies')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
      target: { value: RequestStatus.Draft },
    });

    await waitFor(() =>
      expect(screen.queryByText('Annual safety supplies')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('No requests match these filters')).toBeInTheDocument();
  });

  it('creates a draft with dynamic line items, live totals and server-calculated amounts', async () => {
    renderApp(['/purchase-requests/new']);

    expect(
      await screen.findByRole('heading', { name: 'New purchase request', level: 1 }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Request title/), {
      target: { value: 'Workshop safety equipment' },
    });
    fireEvent.change(screen.getByLabelText(/Business justification/), {
      target: { value: 'Replace worn protective equipment before the next audit.' },
    });
    fireEvent.change(screen.getByLabelText(/Required by/), {
      target: { value: futureDate() },
    });
    fireEvent.change(screen.getByLabelText(/^Description/), {
      target: { value: 'Protective goggles' },
    });
    fireEvent.change(screen.getByLabelText(/^Quantity/), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText(/^Unit price/), {
      target: { value: '10.50' },
    });

    expect(screen.getAllByText('$21.00').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Add line item' }));

    const descriptions = screen.getAllByLabelText(/^Description/);
    const quantities = screen.getAllByLabelText(/^Quantity/);
    const unitPrices = screen.getAllByLabelText(/^Unit price/);

    fireEvent.change(descriptions[1] as HTMLElement, {
      target: { value: 'Replacement filter cartridges' },
    });
    fireEvent.change(quantities[1] as HTMLElement, { target: { value: '3' } });
    fireEvent.change(unitPrices[1] as HTMLElement, { target: { value: '4.00' } });

    expect(screen.getAllByText('$33.00').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Create draft' }));

    expect(
      await screen.findByRole('heading', { name: 'Workshop safety equipment', level: 1 }),
    ).toBeInTheDocument();
    const year = new Date().getUTCFullYear();
    expect(screen.getByText(`Draft PR-${year}-0003 created.`)).toBeInTheDocument();
    expect(screen.getByText(`PR-${year}-0003`)).toBeInTheDocument();
    expect(screen.getAllByText('$33.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Protective goggles')).toBeInTheDocument();
    expect(screen.getByText('Replacement filter cartridges')).toBeInTheDocument();
  });

  it('shows client-side validation errors before creating a request', async () => {
    renderApp(['/purchase-requests/new']);

    await screen.findByRole('heading', { name: 'New purchase request', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Create draft' }));

    expect(
      screen.getByText('Please correct the highlighted fields before saving.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter a request title.')).toBeInTheDocument();
    expect(
      screen.getByText('Enter the business justification for this request.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Select the date this request is required by.')).toBeInTheDocument();
  });

  it('edits an existing draft and refreshes the detail view', async () => {
    renderApp(['/purchase-requests/request-draft-1']);

    expect(
      await screen.findByRole('heading', { name: 'Office equipment refresh', level: 1 }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Edit draft' }));
    expect(
      await screen.findByRole('heading', { name: 'Edit purchase request', level: 1 }),
    ).toBeInTheDocument();

    const titleInput = screen.getByLabelText(/Request title/);
    expect(titleInput).toHaveValue('Office equipment refresh');

    fireEvent.change(titleInput, { target: { value: 'Updated office equipment refresh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByRole('heading', {
        name: 'Updated office equipment refresh',
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Draft PR-2026-0001 updated.')).toBeInTheDocument();
    expect(screen.getByText('Draft updated')).toBeInTheDocument();
  });

  it('submits a draft after confirmation and locks further actions', async () => {
    renderApp(['/purchase-requests/request-draft-1']);

    await screen.findByRole('heading', { name: 'Office equipment refresh', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Submit PR-2026-0001 for approval?')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit request' }));

    expect(await screen.findByText('PR-2026-0001 was submitted for approval.')).toBeInTheDocument();
    expect(await screen.findByText('Pending approval')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit for approval' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete draft' })).not.toBeInTheDocument();
  });

  it('soft deletes a draft and returns to the list', async () => {
    renderApp(['/purchase-requests/request-draft-1']);

    await screen.findByRole('heading', { name: 'Office equipment refresh', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete PR-2026-0001?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete draft' }));

    expect(
      await screen.findByRole('heading', { name: 'Purchase Requests', level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Draft PR-2026-0001 deleted.')).toBeInTheDocument();
    expect(screen.queryByText('Office equipment refresh')).not.toBeInTheDocument();
    expect(screen.getByText('Annual safety supplies')).toBeInTheDocument();
  });

  it('keeps viewers read-only on the list and detail pages', async () => {
    vi.stubGlobal('fetch', createFetchMock({ session: createTestSession(WorkspaceRole.Viewer) }));

    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Purchase Requests', level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Office equipment refresh')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /New request/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /PR-2026-0001/ }));

    expect(
      await screen.findByRole('heading', { name: 'Office equipment refresh', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit for approval' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete draft' })).not.toBeInTheDocument();
  });

  it('paginates request lists', async () => {
    const base = createTestPurchaseRequests();
    const requests: PurchaseRequestDetail[] = Array.from({ length: 11 }, (_, index) => {
      const source = base[index % base.length] as PurchaseRequestDetail;

      return {
        ...source,
        id: `request-page-${index + 1}`,
        requestNumber: `PR-2026-${String(index + 1).padStart(4, '0')}`,
        title: `Paged request ${index + 1}`,
      };
    });

    vi.stubGlobal('fetch', createFetchMock({ purchaseRequests: requests }));

    renderApp();

    expect(await screen.findByText('Showing 1–10 of 11 requests')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next request page' }));
    expect(await screen.findByText('Showing 11–11 of 11 requests')).toBeInTheDocument();
    expect(screen.getByText('Paged request 11')).toBeInTheDocument();
  });

  it('shows an error state with a retry action', async () => {
    vi.stubGlobal(
      'fetch',
      createFetchMock({
        purchaseRequestsResponse: {
          status: 500,
          body: {
            error: {
              code: 'SERVER_ERROR',
              message: 'The request list could not be loaded.',
            },
          },
        },
      }),
    );

    renderApp();

    expect(await screen.findByText('The request list could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('purchase request currency formatting', () => {
  it('keeps cents when displaying request amounts', async () => {
    const requests = createTestPurchaseRequests().map((request) => ({
      ...request,
      currency: Currency.EUR,
    }));

    vi.stubGlobal('fetch', createFetchMock({ purchaseRequests: requests }));
    renderApp();

    expect(await screen.findByText('€70.17')).toBeInTheDocument();
    expect(screen.getByText('€1,234.50')).toBeInTheDocument();
  });
});
