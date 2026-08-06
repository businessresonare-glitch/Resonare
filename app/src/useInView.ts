import { useEffect, useRef, useState } from 'react';

/** Fraction of the element that must be visible before entrances fire. */
const VISIBILITY_THRESHOLD = 0.1;

/**
 * Fires once when the element crosses the threshold, then disconnects — these
 * are entrance animations, so re-running them on scroll-back would be noise.
 *
 * Falls back to visible when IntersectionObserver is unavailable, so content is
 * never left stranded behind an animation that cannot start.
 */
export default function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: VISIBILITY_THRESHOLD },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}
