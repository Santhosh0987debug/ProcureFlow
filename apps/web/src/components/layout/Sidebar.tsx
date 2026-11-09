import { Building2, PanelLeftClose, X } from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { cn } from '../../lib/cn';
import { navigationSections, settingsNavItem } from '../../data/navigation';
import type { NavItem } from '../../data/navigation';
import { useApiHealth } from '../../hooks/useApiHealth';
import { BrandMark } from './BrandMark';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, mobileOpen, onToggleCollapsed, onCloseMobile }: SidebarProps) {
  const { state: apiState, health } = useApiHealth();
  const { session } = useAuth();
  const workspace = session?.workspaces[0];

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileOpen]);

  const apiStatus =
    apiState === 'online'
      ? { label: 'API connected', dot: 'bg-sage' }
      : apiState === 'offline'
        ? { label: 'API offline', dot: 'bg-clay' }
        : { label: 'Connecting to API', dot: 'animate-pulse bg-taupe' };

  function renderNavItem(item: NavItem) {
    const Icon = item.icon;

    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={onCloseMobile}
        aria-label={item.label}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          cn(
            'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12.5px] font-medium transition-colors duration-150',
            isActive
              ? 'bg-white/[0.085] text-ivory'
              : 'text-ivory/55 hover:bg-white/[0.045] hover:text-ivory/90',
            collapsed && 'lg:justify-center lg:px-0',
          )
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={cn(
                'absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-ivory/80 transition-opacity',
                isActive ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden="true"
            />
            <Icon
              size={17}
              strokeWidth={1.8}
              className={cn(
                'shrink-0 transition-colors',
                isActive ? 'text-ivory' : 'text-ivory/40 group-hover:text-ivory/75',
              )}
              aria-hidden="true"
            />
            <span className={cn('flex-1 truncate text-left', collapsed && 'lg:hidden')}>
              {item.label}
            </span>
            {item.badge !== undefined ? (
              <span
                className={cn(
                  'rounded-full bg-ivory/10 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-ivory/65',
                  collapsed && 'lg:hidden',
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </>
        )}
      </NavLink>
    );
  }

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onCloseMobile}
        className={cn(
          'fixed inset-0 z-40 bg-espresso/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        aria-label="Primary navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-espresso text-ivory transition-[width,transform] duration-300 ease-out lg:translate-x-0',
          collapsed ? 'lg:w-20' : 'lg:w-[264px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div
          className={cn(
            'flex h-[76px] shrink-0 items-center gap-3 border-b border-white/[0.06] px-5',
            collapsed && 'lg:justify-center lg:px-0',
          )}
        >
          <Link
            to="/"
            onClick={onCloseMobile}
            className="min-w-0 rounded-lg"
            aria-label="ProcureFlow dashboard"
          >
            <BrandMark compact={collapsed} />
          </Link>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ivory/50 transition-colors hover:bg-white/[0.06] hover:text-ivory lg:hidden"
          >
            <X size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>

        <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
          {navigationSections.map((section, sectionIndex) => (
            <div key={section.label} className={cn(sectionIndex > 0 && 'pt-5')}>
              <p
                className={cn(
                  'px-3 pb-2 text-[8.5px] font-semibold uppercase tracking-[0.2em] text-ivory/30',
                  collapsed && 'lg:hidden',
                )}
              >
                {section.label}
              </p>
              {sectionIndex > 0 ? (
                <div
                  className={cn(
                    'mx-auto mb-3 hidden h-px w-6 bg-white/[0.08]',
                    collapsed && 'lg:block',
                  )}
                  aria-hidden="true"
                />
              ) : null}
              <div className="space-y-0.5">{section.items.map(renderNavItem)}</div>
            </div>
          ))}

          <div className="mt-5 border-t border-white/[0.06] pt-4">
            {renderNavItem(settingsNavItem)}
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/[0.06] p-3">
          {workspace ? (
            <div
              title={`${workspace.name} · ${workspace.role}`}
              className={cn(
                'mb-1 flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.025] px-3 py-2.5',
                collapsed && 'lg:justify-center lg:px-0',
              )}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ivory/[0.07] text-ivory/60">
                <Building2 size={13} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className={cn('min-w-0', collapsed && 'lg:hidden')}>
                <span className="block truncate text-[10.5px] font-medium text-ivory/75">
                  {workspace.name}
                </span>
                <span className="mt-0.5 block truncate text-[8.5px] capitalize tracking-[0.06em] text-ivory/30">
                  {workspace.role} · {workspace.currency}
                </span>
              </span>
            </div>
          ) : null}

          <div
            title={`${apiStatus.label}${health ? ` · v${health.version}` : ''}`}
            className={cn(
              'mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5',
              collapsed && 'lg:justify-center lg:px-0',
            )}
          >
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', apiStatus.dot)} />
            <span
              className={cn(
                'truncate text-[10px] font-medium text-ivory/45',
                collapsed && 'lg:hidden',
              )}
            >
              {apiStatus.label}
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : undefined}
            className={cn(
              'hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-medium text-ivory/40 transition-colors hover:bg-white/[0.05] hover:text-ivory/75 lg:flex',
              collapsed && 'lg:justify-center lg:px-0',
            )}
          >
            <PanelLeftClose
              size={16}
              strokeWidth={1.8}
              className={cn(
                'shrink-0 transition-transform duration-300',
                collapsed && 'rotate-180',
              )}
              aria-hidden="true"
            />
            <span className={cn(collapsed && 'lg:hidden')}>Collapse sidebar</span>
          </button>
        </div>
      </aside>
    </>
  );
}
