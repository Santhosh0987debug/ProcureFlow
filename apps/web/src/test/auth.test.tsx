import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { createFetchMock } from './api-mock';

function renderApp(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', createFetchMock({ authenticated: false }));
});

describe('authentication flow', () => {
  it('redirects unauthenticated visitors to the login page', async () => {
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Procurement overview', level: 1 }),
    ).not.toBeInTheDocument();
  });

  it('shows validation feedback for an empty login submission', async () => {
    renderApp(['/login']);
    await screen.findByRole('heading', { name: 'Welcome back' });

    fireEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));

    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
  });

  it('signs in and opens the dashboard', async () => {
    renderApp(['/login']);
    await screen.findByRole('heading', { name: 'Welcome back' });

    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'amara.okafor@northwind.example' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'ProcureFlow!2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));

    expect(
      await screen.findByRole('heading', { name: 'Procurement overview', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Amara Okafor').length).toBeGreaterThan(0);
  });

  it('shows the API error when credentials are rejected', async () => {
    vi.stubGlobal(
      'fetch',
      createFetchMock({
        authenticated: false,
        loginResponse: {
          status: 401,
          body: {
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password.',
            },
          },
        },
      }),
    );

    renderApp(['/login']);
    await screen.findByRole('heading', { name: 'Welcome back' });

    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'amara.okafor@northwind.example' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'WrongPass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
  });

  it('registers a new workspace and opens the dashboard', async () => {
    renderApp(['/register']);
    await screen.findByRole('heading', { name: 'Create your workspace' });

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Avery' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Stone' } });
    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'avery.stone@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Workspace name'), {
      target: { value: 'Stone Procurement' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'StrongPass123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'StrongPass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Create workspace$/ }));

    expect(
      await screen.findByRole('heading', { name: 'Procurement overview', level: 1 }),
    ).toBeInTheDocument();
  });

  it('signs out from the profile menu', async () => {
    vi.stubGlobal('fetch', createFetchMock({ authenticated: true }));

    renderApp();
    await screen.findByRole('heading', { name: 'Procurement overview', level: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});
