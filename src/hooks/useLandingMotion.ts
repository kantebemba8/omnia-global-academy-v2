import { useEffect, useState, type RefObject } from 'react';

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
    addEventListener?: (type: 'change', listener: () => void) => void;
    removeEventListener?: (type: 'change', listener: () => void) => void;
  };
};

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function useEnhancedLandingMotion() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktopViewport = window.matchMedia('(min-width: 768px)');
    const connection = (navigator as NavigatorWithConnection).connection;

    const update = () => {
      const slowConnection = connection?.saveData === true || connection?.effectiveType === '2g';
      setEnabled(!reducedMotion.matches && desktopViewport.matches && !slowConnection);
    };

    update();
    reducedMotion.addEventListener('change', update);
    desktopViewport.addEventListener('change', update);
    connection?.addEventListener?.('change', update);

    return () => {
      reducedMotion.removeEventListener('change', update);
      desktopViewport.removeEventListener('change', update);
      connection?.removeEventListener?.('change', update);
    };
  }, []);

  return enabled;
}

export function useElementScrollProgress<T extends HTMLElement>(
  ref: RefObject<T>,
  enabled = true,
) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setProgress(0);
      return;
    }

    let frame = 0;

    const update = () => {
      frame = 0;
      const element = ref.current;
      if (!element) return;

      const rectangle = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const travel = rectangle.height + viewportHeight;
      const value = (viewportHeight - rectangle.top) / Math.max(travel, 1);
      setProgress(previous => {
        const next = clamp(value);
        return Math.abs(previous - next) < 0.002 ? previous : next;
      });
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled, ref]);

  return progress;
}

export function useLandingReveals<T extends HTMLElement>(
  rootRef: RefObject<T>,
  dependencyKey: string,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-oga-reveal]'));
    if (elements.length === 0) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !('IntersectionObserver' in window)) {
      elements.forEach(element => element.classList.add('oga-reveal-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('oga-reveal-visible');
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px',
      },
    );

    elements.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [dependencyKey, rootRef]);
}
