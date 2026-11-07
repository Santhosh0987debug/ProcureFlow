import { Menu, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { Breadcrumbs } from './Breadcrumbs';
import { NotificationMenu } from './NotificationMenu';
import { ProfileMenu } from './ProfileMenu';
import { WorkspaceSearch } from './WorkspaceSearch';

interface HeaderProps {
  onOpenSidebar: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-beige/80 bg-ivory/90 backdrop-blur-md">
      <div className="flex h-[72px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open navigation"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-stone transition-colors hover:bg-white hover:text-espresso lg:hidden"
        >
          <Menu size={19} strokeWidth={1.8} aria-hidden="true" />
        </button>

        <div className="hidden min-w-0 sm:block">
          <Breadcrumbs />
        </div>
        <div className="min-w-0 flex-1 sm:hidden">
          <Breadcrumbs compact />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <WorkspaceSearch className="hidden w-[280px] lg:block xl:w-[320px]" />

          <button
            type="button"
            onClick={() => setMobileSearchOpen((value) => !value)}
            aria-label={mobileSearchOpen ? 'Close search' : 'Open search'}
            aria-expanded={mobileSearchOpen}
            className={cn(
              'grid h-10 w-10 place-items-center rounded-xl border transition-colors duration-150 lg:hidden',
              mobileSearchOpen
                ? 'border-beige bg-white text-espresso'
                : 'border-transparent text-stone hover:border-beige hover:bg-white hover:text-espresso',
            )}
          >
            {mobileSearchOpen ? (
              <X size={18} strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Search size={18} strokeWidth={1.8} aria-hidden="true" />
            )}
          </button>

          <NotificationMenu />
          <div className="mx-0.5 hidden h-6 w-px bg-beige sm:block" aria-hidden="true" />
          <ProfileMenu />
        </div>
      </div>

      {mobileSearchOpen ? (
        <div className="border-t border-beige/70 bg-ivory px-4 py-3 lg:hidden">
          <WorkspaceSearch
            autoFocus
            className="w-full"
            onNavigate={() => setMobileSearchOpen(false)}
          />
        </div>
      ) : null}
    </header>
  );
}
