import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import type { ReactNode } from 'react';

interface RequestErrorPanelProps {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function RequestErrorPanel({ message, onRetry, compact = false }: RequestErrorPanelProps) {
  return (
    <div
      role="alert"
      className={
        compact
          ? 'flex flex-wrap items-start gap-3 px-5 py-5 sm:px-6'
          : 'flex flex-wrap items-start gap-3 rounded-2xl border border-clay/25 bg-[#f5e7e2] px-5 py-5 sm:px-6'
      }
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-clay" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] leading-5 text-[#8a4a3b]">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex h-8 items-center justify-center rounded-lg border border-beige bg-white px-2.5 text-[10.5px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6]"
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function RequestLoadingBlock({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-3 px-5 py-8 text-[12px] text-stone sm:px-6"
      aria-busy="true"
    >
      <Loader2 size={16} className="animate-spin text-taupe" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

interface RequestNoticeProps {
  tone: 'success' | 'error';
  message: string;
  onDismiss?: () => void;
  children?: ReactNode;
}

export function RequestNotice({ tone, message, onDismiss, children }: RequestNoticeProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'success'
          ? 'flex items-start gap-3 rounded-xl border border-sage/25 bg-[#edefe7] px-4 py-3 text-[11.5px] leading-5 text-[#4f5b40]'
          : 'flex items-start gap-3 rounded-xl border border-clay/25 bg-[#f5e7e2] px-4 py-3 text-[11.5px] leading-5 text-[#8a4a3b]'
      }
    >
      {tone === 'success' ? (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      ) : (
        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      )}
      <div className="flex-1">
        <p>{message}</p>
        {children}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100"
        >
          <X size={13} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
