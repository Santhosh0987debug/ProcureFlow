import { ArrowUpRight, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  helper: string;
  trend: string;
  trendTone?: 'default' | 'attention';
  icon: LucideIcon;
  href: string;
}

interface KpiCardProps {
  metric: KpiMetric;
}

export function KpiCard({ metric }: KpiCardProps) {
  const Icon = metric.icon;
  const TrendIcon = metric.trendTone === 'attention' ? Clock : ArrowUpRight;

  return (
    <Link
      to={metric.href}
      aria-label={`${metric.label}: ${metric.value}. ${metric.helper}`}
      className="group flex min-h-[152px] flex-col justify-between rounded-2xl border border-beige bg-white p-5 shadow-card transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-taupe/50 hover:shadow-[0_12px_30px_-22px_rgba(56,44,39,0.38)]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="pt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-taupe">
          {metric.label}
        </p>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-beige/80 bg-ivory text-stone transition-colors duration-200 group-hover:border-espresso group-hover:bg-espresso group-hover:text-ivory">
          <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>

      <div className="mt-5">
        <p className="text-[30px] font-semibold leading-none tracking-[-0.045em] text-espresso tabular-nums">
          {metric.value}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-beige/60 pt-3">
        <span className="truncate text-[10.5px] text-stone">{metric.helper}</span>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 text-[10px] font-medium',
            metric.trendTone === 'attention' ? 'text-clay' : 'text-espresso/55',
          )}
        >
          <TrendIcon size={11} strokeWidth={2} aria-hidden="true" />
          {metric.trend}
        </span>
      </div>
    </Link>
  );
}
