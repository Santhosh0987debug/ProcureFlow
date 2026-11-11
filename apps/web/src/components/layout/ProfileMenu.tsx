import { ChevronDown, LogOut, SlidersHorizontal, UserRound } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { cn } from '../../lib/cn';
import { Avatar } from '../ui/Avatar';
import { useDismissable } from '../../hooks/useDismissable';

const profileLinks = [
  { label: 'Account profile', to: '/settings', icon: UserRound },
  { label: 'Workspace settings', to: '/settings', icon: SlidersHorizontal },
];

export function ProfileMenu() {
  const { session, activeWorkspace, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useDismissable(open, () => setOpen(false), containerRef);

  const user = session?.user;
  const workspace = activeWorkspace;

  if (!user) {
    return null;
  }

  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const roleLabel = user.jobTitle ?? 'Workspace member';

  async function handleLogout(): Promise<void> {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    setOpen(false);

    try {
      await logout();
    } catch {
      // The local session is cleared even when the network request fails.
    }

    navigate('/login', { replace: true });
  }

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
        <Avatar name={fullName} size="md" tone="dark" />
        <span className="hidden text-left xl:block">
          <span className="block text-[11px] font-semibold leading-4 text-espresso">
            {fullName}
          </span>
          <span className="block text-[9px] leading-4 text-taupe">{roleLabel}</span>
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
          className="animate-dropdown absolute right-0 top-[calc(100%+10px)] z-50 w-[270px] overflow-hidden rounded-2xl border border-beige bg-white shadow-dropdown"
        >
          <div className="flex items-center gap-3 border-b border-beige/70 px-4 py-3.5">
            <Avatar name={fullName} size="lg" tone="dark" />
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-espresso">{fullName}</p>
              <p className="truncate text-[10px] text-stone">{user.email}</p>
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

            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] text-stone transition-colors hover:bg-ivory hover:text-espresso disabled:cursor-wait disabled:opacity-60"
            >
              <LogOut size={15} strokeWidth={1.8} className="text-taupe" aria-hidden="true" />
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-beige/70 bg-ivory/40 px-4 py-2.5">
            <span className="truncate text-[9px] uppercase tracking-[0.1em] text-taupe">
              {workspace?.name ?? 'Workspace'}
            </span>
            <span className="shrink-0 text-[9px] text-taupe">v0.3.0 · Phase 3</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
