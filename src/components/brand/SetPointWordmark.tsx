import type { HTMLAttributes } from 'react';

type WordmarkVariant = 'hero' | 'shell' | 'compact';

export interface SetPointWordmarkProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  variant?: WordmarkVariant;
  showTagline?: boolean;
  decorative?: boolean;
}

function BeamTGlyph() {
  return (
    <span className="setpoint-letter setpoint-letter-beam" aria-hidden="true">
      <svg viewBox="0 0 44 64" focusable="false">
        <path className="beam-flange" d="M3 5.5c0-1.5 1.2-2.7 2.7-2.7h32.6c1.5 0 2.7 1.2 2.7 2.7v7.8c0 1.5-1.2 2.7-2.7 2.7H5.7A2.7 2.7 0 0 1 3 13.3V5.5Z" />
        <path className="beam-web" d="M17.8 14.8c0-1 .8-1.8 1.8-1.8h4.8c1 0 1.8.8 1.8 1.8v35.8c0 1-.8 1.8-1.8 1.8h-4.8c-1 0-1.8-.8-1.8-1.8V14.8Z" />
        <path className="beam-flange" d="M8 49.8c0-1.5 1.2-2.8 2.8-2.8h22.4c1.5 0 2.8 1.3 2.8 2.8v8c0 1.6-1.3 2.9-2.8 2.9H10.8A2.8 2.8 0 0 1 8 57.8v-8Z" />
        <path className="beam-edge" d="M6.8 8.6h30.4" />
        <path className="beam-edge" d="M10.8 53.6h22.4" />
        <path className="beam-web-line" d="M19.6 16.9v33.6" />
        <path className="beam-web-line" d="M24.4 16.9v33.6" />
      </svg>
    </span>
  );
}

function CraneTGlyph() {
  return (
    <span className="setpoint-letter setpoint-letter-crane" aria-hidden="true">
      <svg viewBox="0 0 46 64" focusable="false">
        <path className="crane-mast" d="M19.4 4.8c0-1 .8-1.8 1.8-1.8h3.6c1 0 1.8.8 1.8 1.8v49.1c0 1-.8 1.8-1.8 1.8h-3.6c-1 0-1.8-.8-1.8-1.8V4.8Z" />
        <path className="crane-mast-brace" d="M20.2 12.2h6" />
        <path className="crane-mast-brace" d="M20.2 18.8h6" />
        <path className="crane-mast-brace" d="M20.2 25.4h6" />
        <path className="crane-mast-brace" d="M20.2 32h6" />
        <path className="crane-mast-brace" d="M20.2 38.6h6" />
        <path className="crane-mast-brace" d="M20.2 45.2h6" />

        <path className="crane-jib" d="M23 15.6H42" />
        <path className="crane-jib" d="M6 15.6h17" />
        <path className="crane-truss" d="M23 15.6l4.7 4.8" />
        <path className="crane-truss" d="M23 15.6l7.9 4.8" />
        <path className="crane-truss" d="M23 15.6l11.3 4.8" />
        <path className="crane-truss" d="M23 15.6l14.2 4.8" />
        <path className="crane-truss" d="M23 15.6l-4.8 4.8" />
        <path className="crane-truss" d="M23 15.6l-8 4.8" />
        <path className="crane-hook-cable" d="M34.2 15.6v14.2" />
        <path className="crane-hook" d="M34.2 29.8h3.6c0 2.3-1.4 3.8-3.6 3.8" />
        <path className="crane-base" d="M17 55.8h12" />
      </svg>
    </span>
  );
}

export function SetPointWordmark({
  variant = 'shell',
  showTagline = false,
  decorative = false,
  className,
  ...rest
}: SetPointWordmarkProps) {
  const classes = ['setpoint-wordmark', `setpoint-wordmark-${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'SetPoint'}
      aria-hidden={decorative ? true : undefined}
      {...rest}
    >
      <span className="setpoint-wordmark-line" aria-hidden="true">
        <span>Se</span>
        <BeamTGlyph />
        <span>Poin</span>
        <CraneTGlyph />
      </span>
      {showTagline ? <span className="setpoint-wordmark-tagline">FROM INTAKE TO CLOSEOUT</span> : null}
    </div>
  );
}
