import { Check, Copy, Link2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CreateInvitationResult, InvitationLinkResult } from '@procureflow/shared';
import { formatShortDate } from '../../lib/format';
import { Dialog } from '../ui/Dialog';

type LinkResult = CreateInvitationResult | InvitationLinkResult;

interface InvitationLinkDialogProps {
  result: LinkResult | null;
  onClose: () => void;
}

export function InvitationLinkDialog({ result, onClose }: InvitationLinkDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    setCopied(false);
    setCopyError(null);
  }, [result]);

  const invitationUrl = result && 'invitationUrl' in result ? result.invitationUrl : undefined;

  async function handleCopy(): Promise<void> {
    if (!invitationUrl) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard is unavailable.');
      }

      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
      setCopyError(null);
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setCopyError('Copying automatically is unavailable. Select the link and copy it manually.');
    }
  }

  return (
    <Dialog
      open={result !== null}
      title={invitationUrl ? 'Invitation link ready' : 'Invitation created'}
      description={
        result
          ? `Invitation for ${result.invitation.email} as ${result.invitation.role.replaceAll('_', ' ')}.`
          : undefined
      }
      onClose={onClose}
      size="md"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center justify-center rounded-xl bg-espresso px-3.5 text-[12px] font-medium text-ivory transition-colors hover:bg-espresso-light"
        >
          Done
        </button>
      }
    >
      {result ? (
        <div className="space-y-4">
          {invitationUrl ? (
            <div>
              <label
                htmlFor="invitation-link"
                className="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-stone"
              >
                One-time invitation link
              </label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Link2
                    size={15}
                    strokeWidth={1.8}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-taupe"
                    aria-hidden="true"
                  />
                  <input
                    ref={inputRef}
                    id="invitation-link"
                    readOnly
                    value={invitationUrl}
                    onFocus={(event) => event.target.select()}
                    className="h-11 w-full rounded-xl border border-beige bg-ivory/60 pl-10 pr-3 text-[11.5px] text-espresso outline-none focus:border-taupe focus:ring-2 focus:ring-taupe/15"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-beige bg-white px-3.5 text-[12px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6]"
                >
                  {copied ? (
                    <Check size={14} className="text-sage" aria-hidden="true" />
                  ) : (
                    <Copy size={14} className="text-taupe" aria-hidden="true" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              {copyError ? (
                <p role="alert" className="mt-1.5 text-[10px] leading-4 text-clay">
                  {copyError}
                </p>
              ) : null}
              <p className="mt-2 text-[10.5px] leading-5 text-stone">
                Share this link directly with the invitee. It can be used once and expires{' '}
                {formatShortDate(result.invitation.expiresAt)}.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-beige bg-ivory/60 px-3.5 py-3 text-[11.5px] leading-5 text-stone">
              The invitation is pending. Email delivery is not configured in this environment, so no
              invitation link was exposed. Configure development link delivery or production email
              delivery to share it.
            </div>
          )}

          <div className="rounded-xl border border-beige/70 bg-white px-3.5 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-taupe">
              Security note
            </p>
            <p className="mt-1 text-[10.5px] leading-5 text-stone">
              ProcureFlow stores only a hash of the invitation token. Creating a new copy-link
              rotates the token and invalidates the previous link.
            </p>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
