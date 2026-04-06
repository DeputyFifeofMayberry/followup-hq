import type { HTMLAttributes } from 'react';

export interface SetPointMonogramProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  decorative?: boolean;
}

export function SetPointMonogram({ decorative = false, className, ...rest }: SetPointMonogramProps) {
  const classes = ['setpoint-monogram', className].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'SetPoint monogram'}
      aria-hidden={decorative ? true : undefined}
      {...rest}
    >
      <span className="setpoint-monogram-beam" aria-hidden="true" />
      <span className="setpoint-monogram-crane" aria-hidden="true" />
    </div>
  );
}
