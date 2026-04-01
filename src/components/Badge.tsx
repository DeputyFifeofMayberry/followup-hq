import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type Variant = 'neutral' | 'warn' | 'danger' | 'success' | 'blue' | 'purple' | 'green' | 'gold';

const tones: Record<Variant, string> = {
  neutral: 'border-slate-300 bg-slate-100 text-slate-700',
  warn: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  blue: 'border-sky-200 bg-sky-50 text-sky-700',
  purple: 'border-violet-200 bg-violet-50 text-violet-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  gold: 'border-yellow-200 bg-yellow-50 text-yellow-800',
};

export function Badge({ children, variant = 'neutral' }: { children: ReactNode; variant?: Variant }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', tones[variant])}>
      {children}
    </span>
  );
}
