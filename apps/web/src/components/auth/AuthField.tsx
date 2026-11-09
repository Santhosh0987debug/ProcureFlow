import type { LucideIcon } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
}

export function AuthField({
  id,
  label,
  icon: Icon,
  error,
  hint,
  trailing,
  className,
  ...props
}: AuthFieldProps) {
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-stone"
      >
        {label}
      </label>
      <div className="relative">
        <Icon
          size={15}
          strokeWidth={1.8}
          className={cn(
            'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2',
            error ? 'text-clay' : 'text-taupe',
          )}
          aria-hidden="true"
        />
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={descriptionId}
          className={cn(
            'h-11 w-full rounded-xl border bg-white pl-10 pr-10 text-[12.5px] text-espresso shadow-[0_1px_0_rgba(56,44,39,0.02)] transition-colors duration-150 placeholder:text-taupe/70',
            error ? 'border-clay/55' : 'border-beige hover:border-taupe/50 focus:border-taupe',
            className,
          )}
          {...props}
        />
        {trailing}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[10px] leading-4 text-clay">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[10px] leading-4 text-taupe">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
