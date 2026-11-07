import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { PageSkeleton } from '../ui/PageSkeleton';
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

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

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
