import { Eye, EyeOff } from 'lucide-react';

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
}

export function PasswordToggle({ visible, onToggle }: PasswordToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Hide password' : 'Show password'}
      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-taupe transition-colors hover:bg-ivory hover:text-espresso"
    >
      {visible ? (
        <EyeOff size={15} strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <Eye size={15} strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  );
}
