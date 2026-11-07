import { ArrowRight, Bell } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { formatRelativeTime } from '../../lib/format';
import { initialNotifications } from '../../data/notifications';
import { useDismissable } from '../../hooks/useDismissable';

export function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const containerRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((notification) => notification.unread).length;

  useDismissable(open, () => setOpen(false), containerRef);

  function markAllAsRead(): void {
    setNotifications((items) => items.map((item) => ({ ...item, unread: false })));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'relative grid h-10 w-10 place-items-center rounded-xl border transition-colors duration-150',
          open
            ? 'border-beige bg-white text-espresso'
            : 'border-transparent text-stone hover:border-beige hover:bg-white hover:text-espresso',
        )}
      >
        <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span
            className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-clay ring-2 ring-ivory"
            aria-hidden="true"
          />
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="animate-dropdown absolute right-0 top-[calc(100%+10px)] z-50 w-[350px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-beige bg-white shadow-dropdown"
        >
          <div className="flex items-start justify-between gap-3 border-b border-beige/70 px-4 py-3.5">
            <div>
              <p className="text-[13px] font-semibold tracking-[-0.01em] text-espresso">
                Notifications
              </p>
              <p className="mt-0.5 text-[10px] text-taupe">
                {unreadCount > 0 ? `${unreadCount} unread updates` : 'Everything is up to date'}
              </p>
            </div>
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="rounded-md text-[10px] font-medium text-stone transition-colors hover:text-espresso disabled:cursor-default disabled:text-taupe/60"
            >
              Mark all read
            </button>
          </div>

          <ul className="divide-y divide-beige/60">
            {notifications.map((notification) => {
              const Icon = notification.icon;

              return (
                <li key={notification.id}>
                  <Link
                    to={notification.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex gap-3 px-4 py-3.5 transition-colors hover:bg-ivory/70',
                      notification.unread && 'bg-ivory/35',
                    )}
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-beige bg-white text-stone">
                      <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-[12px] font-medium leading-5 text-espresso">
                          {notification.title}
                        </span>
                        {notification.unread ? (
                          <span
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-clay"
                            aria-hidden="true"
                          />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-stone">
                        {notification.description}
                      </span>
                      <span className="mt-1 block text-[9px] uppercase tracking-[0.08em] text-taupe">
                        {formatRelativeTime(notification.occurredAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-beige/70">
            {unreadCount === 0 ? (
              <p className="bg-ivory/40 px-4 py-2.5 text-center text-[10px] text-stone">
                You&apos;re all caught up.
              </p>
            ) : null}
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-4 py-3 text-[11px] font-medium text-stone transition-colors hover:bg-ivory/60 hover:text-espresso"
            >
              Notification settings
              <ArrowRight size={13} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
