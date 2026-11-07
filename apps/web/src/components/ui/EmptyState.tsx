import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center px-6 text-center',
        compact ? 'py-10' : 'py-14 sm:py-16',
        className,
      )}
    >
      <div className="relative mb-5 grid h-14 w-14 place-items-center rounded-full border border-beige bg-ivory text-stone">
        <Icon size={21} strokeWidth={1.6} aria-hidden="true" />
      </div>
      <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">{title}</h3>
      <p className="mt-2 max-w-md text-[13px] leading-6 text-stone">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
