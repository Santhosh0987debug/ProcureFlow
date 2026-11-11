import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { cn } from '../../lib/cn';
import { filterNavigationItems } from '../../data/navigation';
import type { NavItem } from '../../data/navigation';
import { useDismissable } from '../../hooks/useDismissable';

interface WorkspaceSearchProps {
  className?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
}

export function WorkspaceSearch({
  className,
  autoFocus = false,
  onNavigate,
}: WorkspaceSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(autoFocus);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId().replaceAll(':', '');
  const navigate = useNavigate();
  const { hasAnyPermission } = useAuth();
  const searchableItems = useMemo(
    () => filterNavigationItems(hasAnyPermission),
    [hasAnyPermission],
  );

  useDismissable(open, () => setOpen(false), containerRef);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return searchableItems;
    }

    return searchableItems.filter((item) => {
      const labelMatches = item.label.toLowerCase().includes(normalizedQuery);
      const keywordMatches = item.keywords?.some((keyword) =>
        keyword.toLowerCase().includes(normalizedQuery),
      );

      return labelMatches || keywordMatches;
    });
  }, [query, searchableItems]);

  const activeItem = results[activeIndex];

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      setOpen(true);
    }
  }, [autoFocus]);

  function selectItem(item: NavItem | undefined): void {
    if (!item) {
      return;
    }

    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    onNavigate?.();
    navigate(item.to);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);

      if (results.length > 0) {
        setActiveIndex((index) => (index + 1) % results.length);
      }
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);

      if (results.length > 0) {
        setActiveIndex((index) => (index - 1 + results.length) % results.length);
      }
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      selectItem(activeItem);
    }

    if (event.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;

        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setOpen(false);
        }
      }}
    >
      <div className="relative">
        <Search
          size={15}
          strokeWidth={1.8}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-taupe"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Search workspace"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && activeItem ? `${listboxId}-result-${activeIndex}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          placeholder="Search workspace..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="h-10 w-full rounded-xl border border-beige bg-white/70 pl-9 pr-3 text-[13px] text-espresso outline-none transition-colors placeholder:text-taupe hover:border-taupe/50 focus:border-taupe/60 focus:bg-white focus:ring-2 focus:ring-taupe/15"
        />
      </div>

      {open ? (
        <div className="animate-dropdown absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-beige bg-white shadow-dropdown">
          <div className="flex items-center justify-between border-b border-beige/70 px-3.5 py-2.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-taupe">
              Navigate
            </span>
            <span className="text-[10px] text-taupe">
              {results.length} {results.length === 1 ? 'page' : 'pages'}
            </span>
          </div>

          {results.length > 0 ? (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Workspace pages"
              className="max-h-[320px] overflow-y-auto p-1.5"
            >
              {results.map((item, index) => {
                const Icon = item.icon;
                const isActive = index === activeIndex;

                return (
                  <li key={item.to} role="presentation">
                    <button
                      type="button"
                      id={`${listboxId}-result-${index}`}
                      role="option"
                      aria-selected={isActive}
                      tabIndex={-1}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectItem(item)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                        isActive ? 'bg-ivory text-espresso' : 'text-stone hover:bg-ivory/70',
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors',
                          isActive
                            ? 'border-beige bg-white text-espresso'
                            : 'border-transparent bg-ivory text-taupe',
                        )}
                      >
                        <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{item.label}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-taupe">
                          {item.to === '/' ? 'Procurement overview' : 'Procurement workspace'}
                        </span>
                      </span>
                      {isActive ? (
                        <CornerDownLeft size={13} className="text-taupe" aria-hidden="true" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-5 py-8 text-center">
              <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-ivory text-taupe">
                <Search size={16} strokeWidth={1.7} aria-hidden="true" />
              </div>
              <p className="text-[13px] font-medium text-espresso">No pages found</p>
              <p className="mt-1 text-[11px] leading-5 text-stone">
                Try a different term or browse the sidebar.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-beige/70 bg-ivory/40 px-3.5 py-2.5 text-[9px] text-taupe">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-beige bg-white px-1 py-0.5 font-sans text-[9px]">
                ↑
              </kbd>
              <kbd className="rounded border border-beige bg-white px-1 py-0.5 font-sans text-[9px]">
                ↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-beige bg-white px-1 py-0.5 font-sans text-[9px]">
                ↵
              </kbd>
              open
            </span>
            <span className="ml-auto flex items-center gap-1">
              <kbd className="rounded border border-beige bg-white px-1 py-0.5 font-sans text-[9px]">
                esc
              </kbd>
              close
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
