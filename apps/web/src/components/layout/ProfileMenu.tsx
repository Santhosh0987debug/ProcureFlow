import { ChevronDown, SlidersHorizontal, UserRound } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { Avatar } from '../ui/Avatar';
import { useDismissable } from '../../hooks/useDismissable';

const profileLinks = [
  { label: 'Account profile', to: '/settings', icon: UserRound },
  { label: 'Workspace settings', to: '/settings', icon: SlidersHorizontal },
];

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useDismissable(open, () => setOpen(false), containerRef);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Open profile menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex items-center gap-2.5 rounded-xl border py-1 pl-1 pr-2 transition-colors duration-150',
          open ? 'border-beige bg-white' : 'border-transparent hover:border-beige hover:bg-white',
        )}
      >
        <Avatar name="Alex Morgan" size="md" tone="dark" />
        <span className="hidden text-left xl:block">
          <span className="block text-[11px] font-semibold leading-4 text-espresso">
            Alex Morgan
          </span>
          <span className="block text-[9px] leading-4 text-taupe">Procurement Lead</span>
        </span>
        <ChevronDown
          size={13}
          strokeWidth={1.8}
          className={cn(
            'hidden text-taupe transition-transform duration-150 xl:block',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Profile menu"
          className="animate-dropdown absolute right-0 top-[calc(100%+10px)] z-50 w-[260px] overflow-hidden rounded-2xl border border-beige bg-white shadow-dropdown"
        >
          <div className="flex items-center gap-3 border-b border-beige/70 px-4 py-3.5">
            <Avatar name="Alex Morgan" size="lg" tone="dark" />
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-espresso">Alex Morgan</p>
              <p className="truncate text-[10px] text-stone">alex.morgan@procureflow.io</p>
            </div>
          </div>

          <div className="p-1.5">
            {profileLinks.map((link) => {
              const Icon = link.icon;

              return (
                <Link
                  key={link.label}
                  to={link.to}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] text-stone transition-colors hover:bg-ivory hover:text-espresso"
                >
                  <Icon size={15} strokeWidth={1.8} className="text-taupe" aria-hidden="true" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-beige/70 bg-ivory/40 px-4 py-2.5">
            <span className="text-[9px] uppercase tracking-[0.1em] text-taupe">Workspace</span>
            <span className="text-[9px] text-taupe">v0.1.0 · Phase 1</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
