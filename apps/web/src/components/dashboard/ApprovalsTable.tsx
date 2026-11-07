import type { ApprovalSummary } from '@procureflow/shared';
import { ArrowRight, BadgeCheck, ChevronRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatSubmissionTime } from '../../lib/format';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { StatusBadge } from '../ui/StatusBadge';

interface ApprovalsTableProps {
  approvals: ApprovalSummary[];
  total: number;
  dueToday: number;
}

export function ApprovalsTable({ approvals, total, dueToday }: ApprovalsTableProps) {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-beige/70 px-5 py-5 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
              Pending approvals
            </h2>
            <span className="rounded-full bg-parchment px-2 py-0.5 text-[9px] font-semibold tabular-nums text-stone">
              {total}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-stone">Requests waiting for your review</p>
        </div>
        <Link
          to="/approvals"
          className="mt-0.5 inline-flex items-center gap-1 rounded-md text-[10.5px] font-medium text-stone transition-colors hover:text-espresso"
        >
          View all
          <ArrowRight size={12} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </div>

      {approvals.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="No approvals waiting"
          description="New requests will appear here when they are ready for review."
          compact
        />
      ) : (
        <>
          <div className="hidden flex-1 md:block">
            <table className="w-full text-left" aria-label="Pending approvals">
              <thead>
                <tr className="border-b border-beige/60 bg-ivory/40">
                  <th
                    scope="col"
                    className="px-5 py-2.5 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-taupe sm:px-6"
                  >
                    Request
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right text-[8.5px] font-semibold uppercase tracking-[0.14em] text-taupe"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-taupe"
                  >
                    Status
                  </th>
                  <th scope="col" className="w-9 pr-4">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige/60">
                {approvals.map((approval) => (
                  <tr key={approval.id} className="group transition-colors hover:bg-ivory/50">
                    <td className="px-5 py-3.5 sm:px-6">
                      <Link to="/approvals" className="block min-w-0">
                        <span className="block truncate text-[12.5px] font-medium text-espresso">
                          {approval.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-stone">
                          {approval.requester.name} · {approval.department} ·{' '}
                          {approval.requestReference}
                        </span>
                        <span className="mt-0.5 block text-[9px] text-taupe">
                          {formatSubmissionTime(approval.submittedAt)}
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-right text-[12px] font-medium tabular-nums text-espresso">
                      {formatCurrency(approval.amount.amount, approval.amount.currency)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5">
                      <StatusBadge status={approval.status} />
                    </td>
                    <td className="pr-4">
                      <Link
                        to="/approvals"
                        aria-label={`Review ${approval.requestReference}`}
                        className="grid h-7 w-7 place-items-center rounded-lg text-taupe opacity-0 transition-all duration-150 hover:bg-white hover:text-espresso group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex-1 divide-y divide-beige/60 md:hidden">
            {approvals.map((approval) => (
              <li key={approval.id}>
                <Link
                  to="/approvals"
                  className="block px-5 py-4 transition-colors hover:bg-ivory/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium text-espresso">
                        {approval.title}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-stone">
                        {approval.requester.name} · {approval.department}
                      </p>
                    </div>
                    <StatusBadge status={approval.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="truncate text-[9px] text-taupe">
                      {approval.requestReference} · {formatSubmissionTime(approval.submittedAt)}
                    </span>
                    <span className="shrink-0 text-[12px] font-medium tabular-nums text-espresso">
                      {formatCurrency(approval.amount.amount, approval.amount.currency)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-beige/70 px-5 py-3 sm:px-6">
            <span className="flex items-center gap-1.5 text-[9.5px] text-taupe">
              <Clock size={11} strokeWidth={1.8} aria-hidden="true" />
              {dueToday} due today
            </span>
            <span className="text-[9.5px] text-taupe">
              Showing {approvals.length} of {total}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
