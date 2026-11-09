import { Check, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { BrandMark } from '../layout/BrandMark';

const principles = [
  'One source of truth for spend, suppliers and approvals.',
  'Auditable from the first request to final delivery.',
  'Designed for procurement, finance and operations.',
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden min-h-screen flex-col overflow-hidden bg-espresso px-12 py-10 lg:flex xl:px-16">
        <div className="relative z-10">
          <BrandMark />
        </div>

        <div className="relative z-10 my-auto max-w-[480px] py-16">
          <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-taupe">
            Procurement, considered
          </p>
          <p className="mt-5 text-[42px] font-semibold leading-[1.06] tracking-[-0.045em] text-ivory xl:text-[48px]">
            Every decision,
            <br />
            in clear view.
          </p>
          <p className="mt-6 max-w-[390px] text-[13px] leading-6 text-ivory/50">
            A premium workspace for teams who treat procurement as a craft — calm, accountable and
            built around the decisions that matter.
          </p>

          <ul className="mt-9 space-y-3.5">
            {principles.map((principle) => (
              <li key={principle} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-ivory/10 bg-ivory/[0.06]">
                  <Check size={11} strokeWidth={2} className="text-ivory/65" aria-hidden="true" />
                </span>
                <span className="text-[11.5px] leading-5 text-ivory/55">{principle}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 max-w-[420px] border-t border-white/[0.08] pt-6">
          <p className="text-[12px] leading-6 text-ivory/60">
            “ProcureFlow gives us one calm, auditable view from request to delivery. It has become
            the operating rhythm for our procurement team.”
          </p>
          <div className="mt-4 flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ivory/10 text-[10px] font-semibold text-ivory">
              AO
            </span>
            <div>
              <p className="text-[10.5px] font-medium text-ivory/80">Amara Okafor</p>
              <p className="text-[9px] text-ivory/35">Head of Procurement · Northwind Industrial</p>
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute -right-40 top-[16%] h-[460px] w-[460px] rounded-full border border-white/[0.05]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-24 top-[26%] h-[300px] w-[300px] rounded-full border border-white/[0.04]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-[18%] h-[280px] w-[280px] rounded-full border border-white/[0.035]"
          aria-hidden="true"
        />
      </aside>

      <main className="flex min-h-screen flex-col bg-ivory">
        <div className="flex h-[76px] items-center justify-between border-b border-white/[0.06] bg-espresso px-5 lg:hidden">
          <BrandMark />
          <ShieldCheck size={18} strokeWidth={1.7} className="text-taupe" aria-hidden="true" />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12 lg:py-12">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>

        <div className="px-5 pb-6 text-center text-[9px] text-taupe sm:px-8">
          © {new Date().getFullYear()} ProcureFlow · Secure procurement workspace
        </div>
      </main>
    </div>
  );
}
