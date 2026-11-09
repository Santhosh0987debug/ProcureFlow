import { AlertCircle } from 'lucide-react';

export function AuthErrorBanner({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-2.5 rounded-xl border border-clay/20 bg-clay/[0.055] px-3.5 py-3 text-[11px] leading-5 text-clay"
    >
      <AlertCircle size={15} strokeWidth={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
