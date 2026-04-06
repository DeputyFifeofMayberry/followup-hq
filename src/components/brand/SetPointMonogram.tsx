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
      <svg className="setpoint-monogram-glyph" viewBox="0 0 64 64" focusable="false" aria-hidden="true">
        <g className="setpoint-monogram-beam">
          <path d="M6 12.6c0-1.1.9-2 2-2h20c1.1 0 2 .9 2 2v4.2c0 1.1-.9 2-2 2H8a2 2 0 0 1-2-2v-4.2Z" />
          <path d="M15 18.4h6v21.4h-6z" />
          <path d="M11 37.2c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v4.4c0 1.1-.9 2-2 2H13a2 2 0 0 1-2-2v-4.4Z" />
        </g>
        <g className="setpoint-monogram-crane">
          <path d="M38.8 12.2h4.4v28h-4.4z" />
          <path d="M41 18.2h17" />
          <path d="M28 18.2h13" />
          <path d="M41 18.2l9.4 5" />
          <path d="M41 18.2l-6.2 5" />
          <path d="M50.4 18.2v9" />
          <path d="M50.4 27.2h2.6c0 1.8-1.1 2.8-2.6 2.8" />
        </g>
      </svg>
    </div>
  );
}
