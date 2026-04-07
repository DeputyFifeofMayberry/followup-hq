import { useEffect, useState } from 'react';

export type ViewportBand = 'phone' | 'tablet' | 'desktop';

const PHONE_MAX = 699;
const TABLET_MAX = 1099;

function resolveViewportBand(width: number): ViewportBand {
  if (width <= PHONE_MAX) return 'phone';
  if (width <= TABLET_MAX) return 'tablet';
  return 'desktop';
}

export function useViewportBand() {
  const [band, setBand] = useState<ViewportBand>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return resolveViewportBand(window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setBand(resolveViewportBand(window.innerWidth));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return {
    band,
    isPhone: band === 'phone',
    isTablet: band === 'tablet',
    isMobileLike: band !== 'desktop',
  };
}
