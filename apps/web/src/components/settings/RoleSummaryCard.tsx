import { PERMISSION_DEFINITIONS, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@procureflow/shared';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Card } from '../ui/Card';

export function RoleSummaryCard() {
  const { activeWorkspace } = useAuth();

  if (!activeWorkspace) {
    return null;
  }

  const granted = new Set(activeWorkspace.permissions);
  const groups = Array.from(new Set(PERMISSION_DEFINITIONS.map((entry) => entry.group)))
    .map((group) => ({
      group,
      items: PERMISSION_DEFINITIONS.filter(
        (entry) => entry.group === group && granted.has(entry.permission),
      ),
    }))
    .filter((entry) => entry.items.length > 0);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-taupe">
            Your access
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-beige bg-ivory text-stone">
              <ShieldCheck size={16} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h2 className="text-[19px] font-semibold tracking-[-0.025em] text-espresso">
              {ROLE_LABELS[activeWorkspace.role]}
            </h2>
            <span className="rounded-full border border-beige bg-white px-2.5 py-1 text-[9.5px] font-medium text-stone">
              {activeWorkspace.permissions.length} permissions
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-6 text-stone">
            {ROLE_DESCRIPTIONS[activeWorkspace.role]}
          </p>
        </div>
      </div>

      <details className="group mt-4 border-t border-beige/70 pt-4">
        <summary className="cursor-pointer list-none text-[11.5px] font-medium text-espresso marker:hidden">
          <span className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 transition-colors hover:text-espresso-light">
            View permission summary
            <span
              className="text-taupe transition-transform group-open:rotate-180"
              aria-hidden="true"
            >
              ▾
            </span>
          </span>
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div key={group.group}>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-taupe">
                {group.group}
              </p>
              <ul className="mt-2 space-y-1.5">
                {group.items.map((entry) => (
                  <li key={entry.permission} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sage"
                      aria-hidden="true"
                    />
                    <span className="text-[11px] leading-5 text-stone">{entry.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </Card>
  );
}
