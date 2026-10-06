import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCentsToCurrency(cents: number | string | bigint, currency = 'USD'): string {
  const numericCents = Number(cents);
  const amount = numericCents / 100;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatSignedCents(
  cents: number | string | bigint,
  currency = 'USD',
): { formatted: string; isNegative: boolean } {
  const numeric = Number(cents);
  const formatted = formatCentsToCurrency(cents, currency);

  if (numeric < 0) {
    return { formatted, isNegative: true };
  }

  if (numeric > 0) {
    return { formatted: '+' + formatted, isNegative: false };
  }

  return { formatted, isNegative: false };
}
