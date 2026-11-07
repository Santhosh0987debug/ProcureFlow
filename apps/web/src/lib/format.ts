import { Currency } from '@procureflow/shared';
import type { Money } from '@procureflow/shared';

export function formatCurrency(amount: number, currency: Currency | string = Currency.USD): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMoney(money: Money): string {
  return formatCurrency(money.amount, money.currency);
}

export function formatCompactCurrency(
  amount: number,
  currency: Currency | string = Currency.USD,
): string {
  const minimumFractionDigits = Math.abs(amount) >= 1_000_000 ? 2 : 0;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    minimumFractionDigits,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatLongDate(value: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

export function formatShortDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatMonthYear(period: string): string {
  const [yearPart, monthPart] = period.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return period;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

export function formatSubmissionTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  if (isSameDay(date, now)) {
    return `Today, ${time}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, yesterday)) {
    return `Yesterday, ${time}`;
  }

  return `${formatShortDate(date)}, ${time}`;
}

export function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));

  if (minutes < 1) {
    return 'Just now';
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.round(hours / 24);

  if (days < 7) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return formatShortDate(date);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}
