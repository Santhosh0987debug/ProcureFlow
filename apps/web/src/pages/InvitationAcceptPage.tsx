import { ROLE_LABELS } from '@procureflow/shared';
import type { AcceptInvitationResult } from '@procureflow/shared';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLoadingScreen } from '../auth/AuthLoadingScreen';
import { useAuth } from '../auth/AuthContext';
import { AuthErrorBanner } from '../components/auth/AuthErrorBanner';
import { BrandMark } from '../components/layout/BrandMark';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Card } from '../components/ui/Card';
import { ApiRequestError } from '../lib/api';
import { apiRequest } from '../lib/api';
import { messageFrom } from '../lib/api-errors';

interface InvitationError {
  message: string;
  code: string;
}

export default function InvitationAcceptPage() {
  const { status, session, applySession, setActiveWorkspace, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState<AcceptInvitationResult | null>(null);
  const [error, setError] = useState<InvitationError | null>(null);

  const returnTo = {
    pathname: location.pathname,
    search: location.search,
  };

  async function handleAccept(): Promise<void> {
    if (accepting || !token) {
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      const result = await apiRequest<AcceptInvitationResult>('/api/invitations/accept', {
        method: 'POST',
        body: { token },
      });

      applySession(result.session);
      setActiveWorkspace(result.workspace.id);
      setAccepted(result);
    } catch (caught) {
      setError({
        message: messageFrom(caught),
        code: caught instanceof ApiRequestError ? caught.code : 'REQUEST_FAILED',
      });
    } finally {
      setAccepting(false);
    }
  }

  async function handleSwitchAccount(): Promise<void> {
    try {
      await logout();
    } catch {
      // The local session is cleared even when the network request fails.
    }

    navigate('/login', { state: { from: returnTo } });
  }

  if (status === 'loading') {
    return <AuthLoadingScreen />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-white/[0.06] bg-espresso px-5 sm:px-8">
        <BrandMark />
        <span className="text-[8.5px] font-semibold uppercase tracking-[0.2em] text-ivory/35">
          Workspace invitation
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-lg">
          <Card className="px-6 py-8 shadow-card sm:px-8">
            {!token ? (
              <div className="text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-clay/20 bg-[#f5e7e2] text-clay">
                  <AlertCircle size={22} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.035em] text-espresso">
                  Invitation link incomplete
                </h1>
                <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-6 text-stone">
                  This link does not include an invitation token. Ask a workspace owner or
                  administrator to send a new invitation.
                </p>
                <div className="mt-6 flex justify-center">
                  <ButtonLink to={status === 'authenticated' ? '/' : '/login'} variant="primary">
                    {status === 'authenticated' ? 'Back to workspace' : 'Go to sign in'}
                  </ButtonLink>
                </div>
              </div>
            ) : accepted ? (
              <div className="text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-sage/25 bg-[#edefe7] text-sage">
                  <CheckCircle2 size={23} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <p className="mt-5 text-[9px] font-semibold uppercase tracking-[0.18em] text-taupe">
                  Invitation accepted
                </p>
                <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.035em] text-espresso">
                  Welcome to {accepted.workspace.name}
                </h1>
                <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-6 text-stone">
                  You joined as {ROLE_LABELS[accepted.membership.role]}. Your active workspace has
                  been switched to {accepted.workspace.name}.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
                  <ButtonLink to="/" variant="primary" icon={ArrowRight}>
                    Open workspace
                  </ButtonLink>
                </div>
              </div>
            ) : status === 'unauthenticated' ? (
              <div className="text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-beige bg-ivory text-stone">
                  <Mail size={22} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <p className="mt-5 text-[9px] font-semibold uppercase tracking-[0.18em] text-taupe">
                  ProcureFlow workspace
                </p>
                <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.035em] text-espresso">
                  You’re invited to join a workspace
                </h1>
                <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-6 text-stone">
                  Sign in or create an account with the email address that received this invitation.
                  The link is single-use and expires automatically.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
                  <ButtonLink
                    to="/login"
                    state={{ from: returnTo }}
                    variant="primary"
                    icon={ArrowRight}
                  >
                    Sign in to accept
                  </ButtonLink>
                  <ButtonLink to="/register" state={{ from: returnTo }} variant="secondary">
                    Create an account
                  </ButtonLink>
                </div>
                <p className="mt-4 text-[10px] leading-5 text-taupe">
                  Use the same email address the invitation was sent to.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-beige bg-ivory text-stone">
                    <ShieldCheck size={19} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-taupe">
                      Workspace invitation
                    </p>
                    <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.035em] text-espresso">
                      Accept your invitation
                    </h1>
                    <p className="mt-1 text-[11.5px] leading-5 text-stone">
                      Signed in as {session?.user.email}. Accepting adds this workspace to your
                      account and switches to it.
                    </p>
                  </div>
                </div>

                {error ? (
                  <div className="mt-4">
                    <AuthErrorBanner message={error.message} />
                  </div>
                ) : null}

                <div className="mt-5 rounded-xl border border-beige/70 bg-ivory/50 px-3.5 py-3">
                  <p className="text-[10.5px] leading-5 text-stone">
                    Invitations only work for the email address they were issued to. If this is not
                    your invitation, switch to the correct account.
                  </p>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={accepting}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-espresso px-4 text-[13px] font-medium text-ivory transition-colors hover:bg-espresso-light disabled:cursor-wait disabled:opacity-70"
                  >
                    {accepting ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : null}
                    {accepting ? 'Accepting invitation…' : 'Accept invitation'}
                  </button>

                  {error?.code === 'INVITATION_EMAIL_MISMATCH' ? (
                    <button
                      type="button"
                      onClick={handleSwitchAccount}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-beige bg-white px-4 text-[12.5px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6]"
                    >
                      Switch account
                    </button>
                  ) : (
                    <Link
                      to="/"
                      className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-[12px] font-medium text-stone transition-colors hover:bg-parchment hover:text-espresso"
                    >
                      Not now
                    </Link>
                  )}
                </div>
              </div>
            )}
          </Card>

          <p className="mt-4 text-center text-[9px] text-taupe">
            ProcureFlow · Secure procurement workspace
          </p>
        </div>
      </main>
    </div>
  );
}
