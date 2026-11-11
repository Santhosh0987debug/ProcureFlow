import { Loader2 } from 'lucide-react';
import { Dialog } from './Dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-beige bg-white px-3.5 text-[12px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={
              tone === 'danger'
                ? 'inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-clay px-3.5 text-[12px] font-medium text-white transition-colors hover:bg-[#934f3e] disabled:cursor-wait disabled:opacity-70'
                : 'inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-espresso px-3.5 text-[12px] font-medium text-ivory transition-colors hover:bg-espresso-light disabled:cursor-wait disabled:opacity-70'
            }
          >
            {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-clay/25 bg-[#f5e7e2] px-3 py-2.5 text-[11.5px] leading-5 text-[#8a4a3b]"
        >
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
