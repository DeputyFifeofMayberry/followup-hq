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
      <svg viewBox="0 0 42 64" focusable="false">
        <rect x="2" y="4" width="38" height="10" rx="3" />
        <rect x="16" y="10" width="10" height="46" rx="4" />
        <rect x="6" y="50" width="30" height="10" rx="3" />
        <line x1="7" y1="9" x2="35" y2="9" />
        <line x1="10" y1="55" x2="32" y2="55" />
      </svg>
    </span>
  );
}

function CraneTGlyph() {
  return (
    <span className="setpoint-letter setpoint-letter-crane" aria-hidden="true">
      <svg viewBox="0 0 46 64" focusable="false">
        <rect x="19" y="4" width="10" height="52" rx="4" />
        <path d="M6 16h34" />
        <path d="M19 16H6l6 8" />
        <path d="M29 16h11l-6 6" />
        <path d="M34 16v18" />
        <path d="M34 34h6" />
        <circle cx="40" cy="34" r="2.2" />
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
