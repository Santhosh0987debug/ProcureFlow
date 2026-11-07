import { cn } from '../../lib/cn';
import { getInitials } from '../../lib/format';

interface AvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  tone?: 'light' | 'dark' | 'taupe';
  className?: string;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-8 w-8 text-[11px]',
  lg: 'h-10 w-10 text-[13px]',
};

const toneClasses = {
  light: 'border border-beige bg-ivory text-stone',
  dark: 'bg-espresso text-ivory',
  taupe: 'bg-parchment text-espresso',
};

export function Avatar({ name, size = 'sm', tone = 'light', className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-semibold tracking-[-0.01em]',
        sizeClasses[size],
        toneClasses[tone],
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
