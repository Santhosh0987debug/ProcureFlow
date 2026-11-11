import { ShieldAlert } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { cn } from '../../lib/cn';
import { PageSkeleton } from '../ui/PageSkeleton';
import { BrandMark } from './BrandMark';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

const SIDEBAR_STORAGE_KEY = 'procureflow:sidebar-collapsed';

function readSidebarPreference(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarPreference);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  async function handleSignOut(): Promise<void> {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  function toggleSidebar(): void {
    setSidebarCollapsed((value) => {
      const nextValue = !value;

      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextValue));
      } catch {
        // The preference is a convenience; storage can be unavailable in private contexts.
      }

      return nextValue;
    });
  }

  if (session && session.workspaces.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-ivory">
        <div className="flex h-[76px] items-center bg-espresso px-5 sm:px-8">
          <BrandMark />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-12">
          <div className="w-full max-w-lg rounded-2xl border border-beige bg-white px-6 py-10 text-center shadow-card sm:px-10">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-beige bg-ivory text-stone">
              <ShieldAlert size={22} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <p className="mt-6 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-taupe">
              Workspace access
            </p>
            <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.035em] text-espresso">
              No active workspace access
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-[13px] leading-6 text-stone">
              Your workspace memberships are suspended or no longer active. Ask a workspace owner or
              administrator to restore access, then sign in again.
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-espresso px-4 text-[13px] font-medium text-ivory transition-colors hover:bg-espresso-light"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-espresso focus:px-4 focus:py-2 focus:text-[12px] focus:font-medium focus:text-ivory"
      >
        Skip to content
      </a>

      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onToggleCollapsed={toggleSidebar}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div
        className={cn(
          'min-h-screen transition-[padding] duration-300 ease-out',
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-[264px]',
        )}
      >
        <Header onOpenSidebar={() => setMobileSidebarOpen(true)} />
        <main
          key={pathname}
          id="main-content"
          className="page-enter mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
