import { WorkspaceRole } from '@procureflow/shared';
import type { AuthSession } from '@procureflow/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { createFetchMock, createTestSession, TEST_INVITATION_TOKEN } from './api-mock';

function renderApp(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );
}

function stubSession(role: WorkspaceRole, mockOptions: Parameters<typeof createFetchMock>[0] = {}) {
  const session = createTestSession(role);
  vi.stubGlobal('fetch', createFetchMock({ ...mockOptions, session }));
  return session;
}

async function openDashboard() {
  return screen.findByRole('heading', { name: 'Procurement overview', level: 1 });
}

beforeEach(() => {
  vi.stubGlobal('fetch', createFetchMock());
});

describe('role-aware workspace access', () => {
  it('shows owners every workspace module and team management', async () => {
    renderApp();
    await openDashboard();

    for (const label of [
      'Purchase Requests',
      'Approvals',
      'Vendors',
      'Quotations',
      'Purchase Orders',
      'Deliveries',
      'Reports',
      'Audit Logs',
      'Settings',
    ]) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('link', { name: 'Settings' }));

    expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Team members')).toBeInTheDocument();
    expect(screen.getAllByText('Amara Okafor').length).toBeGreaterThan(0);
    expect(screen.getByText('Daniel Reyes')).toBeInTheDocument();
    expect(screen.queryByText('Team management is restricted')).not.toBeInTheDocument();
  });

  it('hides procurement-management modules from requesters while keeping their intake tools', async () => {
    stubSession(WorkspaceRole.Requester);
    renderApp();
    await openDashboard();

    expect(screen.getByRole('link', { name: 'Purchase Requests' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vendors' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Approvals' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Reports' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Audit Logs' })).not.toBeInTheDocument();
    expect(screen.queryByText('Pending approvals')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New request' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View reports' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Settings' }));

    expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Team management is restricted')).toBeInTheDocument();
    expect(screen.getByText('Requester')).toBeInTheDocument();
    expect(screen.queryByText('Daniel Reyes')).not.toBeInTheDocument();
  });

  it('lets viewers read reports but blocks approval work', async () => {
    stubSession(WorkspaceRole.Viewer);
    renderApp();
    await openDashboard();

    expect(screen.getByRole('link', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Approvals' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Audit Logs' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Reports' }));

    expect(await screen.findByRole('heading', { name: 'Reports', level: 1 })).toBeInTheDocument();
  });

  it('renders a friendly restricted state for direct unauthorized routes', async () => {
    stubSession(WorkspaceRole.Requester);
    renderApp(['/approvals']);

    expect(await screen.findByRole('heading', { name: 'Access restricted' })).toBeInTheDocument();
    expect(screen.getByText(/Requester role does not include access/)).toBeInTheDocument();
  });

  it('shows a suspended or removed member the no-access state', async () => {
    const suspendedSession: AuthSession = {
      ...createTestSession(WorkspaceRole.Requester),
      workspaces: [],
    };
    vi.stubGlobal('fetch', createFetchMock({ session: suspendedSession }));

    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'No active workspace access', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/memberships are suspended or no longer active/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  });
});

describe('workspace settings team management', () => {
  it('searches the member directory', async () => {
    renderApp(['/settings']);
    await screen.findByRole('heading', { name: 'Settings', level: 1 });
    await screen.findByText('Nadia Hassan');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search members' }), {
      target: { value: 'Nadia' },
    });

    await waitFor(() => {
      expect(screen.getByText('Nadia Hassan')).toBeInTheDocument();
      expect(screen.queryByText('Daniel Reyes')).not.toBeInTheDocument();
    });
  });

  it('invites a member and exposes the development-only link once', async () => {
    renderApp(['/settings']);
    await screen.findByRole('heading', { name: 'Settings', level: 1 });
    await screen.findByText('Nadia Hassan');

    fireEvent.click(screen.getByRole('button', { name: 'Invite member' }));

    const dialog = await screen.findByRole('dialog', { name: 'Invite a workspace member' });
    fireEvent.change(within(dialog).getByLabelText('Email address'), {
      target: { value: 'new.member@example.com' },
    });

    expect(within(dialog).getByLabelText('Role')).toHaveValue(WorkspaceRole.Requester);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create invitation' }));

    const linkDialog = await screen.findByRole('dialog', { name: 'Invitation link ready' });
    expect(within(linkDialog).getByLabelText('One-time invitation link')).toHaveValue(
      `http://localhost:5173/invitations/accept?token=${TEST_INVITATION_TOKEN}`,
    );

    fireEvent.click(within(linkDialog).getByRole('button', { name: 'Done' }));

    expect(
      await screen.findByText('Invitation created for new.member@example.com.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('new.member@example.com')).toBeInTheDocument();
  });

  it('confirms role changes before applying them', async () => {
    renderApp(['/settings']);
    await screen.findByRole('heading', { name: 'Settings', level: 1 });
    await screen.findByText('Daniel Reyes');

    fireEvent.change(screen.getByLabelText('Role for Daniel Reyes'), {
      target: { value: WorkspaceRole.Viewer },
    });

    const dialog = await screen.findByRole('dialog', {
      name: 'Change role for Daniel Reyes?',
    });
    expect(within(dialog).getByText(/Admin to Viewer/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Change role' }));

    expect(await screen.findByText('Daniel Reyes is now Viewer.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('suspends and reactivates a member with confirmation', async () => {
    renderApp(['/settings']);
    await screen.findByRole('heading', { name: 'Settings', level: 1 });
    await screen.findByText('Nadia Hassan');

    fireEvent.click(screen.getByRole('button', { name: 'Suspend Nadia Hassan' }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'Suspend Nadia Hassan?' })).getByRole(
        'button',
        { name: 'Suspend member' },
      ),
    );

    expect(
      await screen.findByText('Nadia Hassan has been suspended from the workspace.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Reactivate Nadia Hassan' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reactivate Nadia Hassan' }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'Reactivate Nadia Hassan?' })).getByRole(
        'button',
        { name: 'Reactivate member' },
      ),
    );

    expect(
      await screen.findByText('Nadia Hassan now has active workspace access.'),
    ).toBeInTheDocument();
  });

  it('revokes a pending invitation', async () => {
    renderApp(['/settings']);
    await screen.findByRole('heading', { name: 'Settings', level: 1 });
    await screen.findByText('grace.lee@northwind.example');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Revoke invitation for grace.lee@northwind.example',
      }),
    );
    fireEvent.click(
      within(
        await screen.findByRole('dialog', {
          name: 'Revoke the invitation for grace.lee@northwind.example?',
        }),
      ).getByRole('button', { name: 'Revoke invitation' }),
    );

    expect(
      await screen.findByText('Invitation for grace.lee@northwind.example was revoked.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('No pending invitations')).toBeInTheDocument();
  });

  it('shows an API authorization error with a retry action', async () => {
    vi.stubGlobal(
      'fetch',
      createFetchMock({
        membersResponse: {
          status: 403,
          body: {
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to view workspace members.',
            },
          },
        },
      }),
    );

    renderApp(['/settings']);

    expect(
      await screen.findByText('You do not have permission to view workspace members.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Try again' }).length).toBeGreaterThan(0);
  });
});

describe('invitation acceptance', () => {
  it('prompts unauthenticated visitors to sign in with the invited email', async () => {
    vi.stubGlobal('fetch', createFetchMock({ authenticated: false }));

    renderApp([`/invitations/accept?token=${TEST_INVITATION_TOKEN}`]);

    expect(
      await screen.findByRole('heading', { name: /invited to join a workspace/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in to accept' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create an account' })).toBeInTheDocument();
  });

  it('accepts an invitation and switches to the joined workspace', async () => {
    renderApp([`/invitations/accept?token=${TEST_INVITATION_TOKEN}`]);

    expect(
      await screen.findByRole('heading', { name: 'Accept your invitation' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));

    expect(
      await screen.findByRole('heading', { name: 'Welcome to Northwind Industrial' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/You joined as Requester/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Open workspace' }));

    expect(await openDashboard()).toBeInTheDocument();
  });

  it('explains an incomplete invitation link', async () => {
    renderApp(['/invitations/accept']);

    expect(
      await screen.findByRole('heading', { name: 'Invitation link incomplete' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/does not include an invitation token/)).toBeInTheDocument();
  });
});
