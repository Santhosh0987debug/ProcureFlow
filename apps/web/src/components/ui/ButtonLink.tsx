import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LinkProps } from 'react-router-dom';
import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  icon?: LucideIcon;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-espresso text-ivory shadow-[0_1px_2px_rgba(56,44,39,0.18)] hover:bg-espresso-light',
  secondary: 'border border-beige bg-white text-espresso hover:border-taupe/60 hover:bg-[#fbf9f6]',
  ghost: 'text-stone hover:bg-parchment hover:text-espresso',
};

export function ButtonLink({
  variant = 'secondary',
  icon: Icon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-medium transition-colors duration-150 active:translate-y-px',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {Icon ? <Icon size={16} strokeWidth={1.8} aria-hidden="true" /> : null}
      {children}
    </Link>
  );
}
