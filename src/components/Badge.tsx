import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type Variant = 'neutral' | 'warn' | 'danger' | 'success' | 'blue' | 'purple' | 'green' | 'gold';
type BadgeKind = 'status' | 'priority' | 'meta';

const tones: Record<Variant, string> = {
  neutral: 'chip-tone-neutral',
  warn: 'chip-tone-warn',
  danger: 'chip-tone-danger',
  success: 'chip-tone-success',
  blue: 'chip-tone-blue',
  purple: 'chip-tone-purple',
  green: 'chip-tone-green',
  gold: 'chip-tone-gold',
};

export function Badge({
  children,
  variant = 'neutral',
  kind = 'meta',
  withDot = false,
  className,
}: {
  children: ReactNode;
  variant?: Variant;
  kind?: BadgeKind;
  withDot?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('app-chip', `app-chip-${kind}`, tones[variant], className)}>
      {withDot ? <span className="app-chip-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
