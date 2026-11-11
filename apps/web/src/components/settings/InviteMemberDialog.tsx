import { ROLE_DESCRIPTIONS, ROLE_LABELS, WorkspaceRole } from '@procureflow/shared';
import type { CreateInvitationResult } from '@procureflow/shared';
import { Loader2, Mail } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { fieldErrorsFrom, messageFrom } from '../../lib/api-errors';
import { inviteMember } from '../../lib/workspace-api';
import { Dialog } from '../ui/Dialog';

interface InviteMemberDialogProps {
  open: boolean;
  workspaceId: string;
  roles: readonly WorkspaceRole[];
  onClose: () => void;
  onCreated: (result: CreateInvitationResult) => void;
}

export function InviteMemberDialog({
  open,
  workspaceId,
  roles,
  onClose,
  onCreated,
}: InviteMemberDialogProps) {
  const emailId = useId();
  const roleId = useId();
  const defaultRole =
    roles.find((entry) => entry === WorkspaceRole.Requester) ?? roles[0] ?? WorkspaceRole.Viewer;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>(defaultRole);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setEmail('');
      setRole(defaultRole);
      setError(null);
      setFieldErrors({});
      setBusy(false);
    }
  }, [open, defaultRole]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (busy) {
      return;
    }

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setFieldErrors({ email: 'Enter the member’s email address.' });
      return;
    }

    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      const result = await inviteMember(workspaceId, { email: trimmedEmail, role });
      onCreated(result);
    } catch (caught) {
      setError(messageFrom(caught));
      setFieldErrors(fieldErrorsFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      title="Invite a workspace member"
      description="Create a one-time invitation. The new member joins with the role you choose and can be managed afterwards."
      onClose={onClose}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-beige bg-white px-3.5 text-[12px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="invite-member-form"
            disabled={busy || roles.length === 0}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-espresso px-3.5 text-[12px] font-medium text-ivory transition-colors hover:bg-espresso-light disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null}
            Create invitation
          </button>
        </>
      }
    >
      <form id="invite-member-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-clay/25 bg-[#f5e7e2] px-3 py-2.5 text-[11.5px] leading-5 text-[#8a4a3b]"
          >
            {error}
          </p>
        ) : null}

        <div>
          <label
            htmlFor={emailId}
            className="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-stone"
          >
            Email address
          </label>
          <div className="relative">
            <Mail
              size={15}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-taupe"
              aria-hidden="true"
            />
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
              placeholder="name@company.com"
              className="h-11 w-full rounded-xl border border-beige bg-white pl-10 pr-3 text-[12.5px] text-espresso outline-none transition-colors placeholder:text-taupe/70 hover:border-taupe/50 focus:border-taupe focus:ring-2 focus:ring-taupe/15"
            />
          </div>
          {fieldErrors.email ? (
            <p id={`${emailId}-error`} className="mt-1.5 text-[10px] leading-4 text-clay">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={roleId}
            className="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-stone"
          >
            Role
          </label>
          <select
            id={roleId}
            value={role}
            onChange={(event) => setRole(event.target.value as WorkspaceRole)}
            aria-describedby={`${roleId}-hint`}
            className="h-11 w-full rounded-xl border border-beige bg-white px-3 text-[12.5px] text-espresso outline-none transition-colors hover:border-taupe/50 focus:border-taupe focus:ring-2 focus:ring-taupe/15"
          >
            {roles.map((entry) => (
              <option key={entry} value={entry}>
                {ROLE_LABELS[entry]}
              </option>
            ))}
          </select>
          <p id={`${roleId}-hint`} className="mt-1.5 text-[10px] leading-4 text-taupe">
            {ROLE_DESCRIPTIONS[role]}
          </p>
          {fieldErrors.role ? (
            <p className="mt-1.5 text-[10px] leading-4 text-clay">{fieldErrors.role}</p>
          ) : null}
        </div>
      </form>
    </Dialog>
  );
}
