import type { HTMLAttributes } from 'react';

import { SetPointWordmark } from './SetPointWordmark';

export interface SetPointMarkProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  decorative?: boolean;
}

export function SetPointMark({ className, decorative = false, ...rest }: SetPointMarkProps) {
  const classes = ['setpoint-mark', className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...rest}>
      <div className="setpoint-mark-frame" aria-hidden="true" />
      <SetPointWordmark variant="hero" showTagline decorative={decorative} />
    </div>
  );
}
