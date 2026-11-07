import { cn } from '../../lib/cn';

interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-ivory shadow-[0_1px_0_rgba(255,255,255,0.12)]">
        <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7" aria-hidden="true">
          <path
            d="M10.5 23.5V8.5h6.4a4.9 4.9 0 0 1 0 9.8h-6.4"
            stroke="#382C27"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="23" cy="23" r="2.2" fill="#A99B8D" />
        </svg>
      </span>
      <span className={cn('min-w-0', compact && 'lg:hidden')}>
        <span className="block truncate text-[15px] font-semibold tracking-[-0.025em] text-ivory">
          ProcureFlow
        </span>
        <span className="mt-0.5 block truncate text-[8.5px] font-semibold uppercase tracking-[0.22em] text-taupe">
          Procurement OS
        </span>
      </span>
    </div>
  );
}
