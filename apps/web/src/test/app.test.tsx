import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../App';

function renderApp(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );
}

describe('ProcureFlow workspace', () => {
  it('renders the procurement dashboard with its key surfaces', async () => {
    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Procurement overview', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Total spend')).toBeInTheDocument();
    expect(screen.getByText('Active requests')).toBeInTheDocument();
    expect(screen.getAllByText('Pending approvals').length).toBeGreaterThan(0);
    expect(screen.getByText('Active purchase orders')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Spending analytics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pending approvals' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent purchase orders' })).toBeInTheDocument();
    expect(await screen.findByText('API connected')).toBeInTheDocument();
  });

  it('navigates from the sidebar into a workspace module', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Procurement overview', level: 1 });

    fireEvent.click(screen.getByRole('link', { name: 'Vendors' }));

    expect(await screen.findByRole('heading', { name: 'Vendors', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Phase 2 module')).toBeInTheDocument();
  });

  it('filters the workspace navigation with search', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Procurement overview', level: 1 });

    const search = screen.getByRole('combobox', { name: 'Search workspace' });
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: 'deliver' } });

    fireEvent.click(screen.getByRole('option', { name: /Deliveries/i }));

    expect(
      await screen.findByRole('heading', { name: 'Deliveries', level: 1 }),
    ).toBeInTheDocument();
  });

  it('marks notifications as read from the header menu', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Procurement overview', level: 1 });

    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));

    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });

  it('switches the spending chart between 6 and 12 months', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Procurement overview', level: 1 });

    const chart = screen.getByRole('group', { name: 'Monthly committed spend chart' });
    expect(within(chart).getAllByRole('button')).toHaveLength(6);

    fireEvent.click(screen.getByRole('button', { name: '12M' }));

    expect(screen.getByText('Total spend · last 12 months')).toBeInTheDocument();
    expect(within(chart).getAllByRole('button')).toHaveLength(12);
  });

  it('collapses the sidebar and remembers the preference', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Procurement overview', level: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(window.localStorage.getItem('procureflow:sidebar-collapsed')).toBe('true');
  });
});
