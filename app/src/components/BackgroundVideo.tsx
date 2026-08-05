import { useCallback, useEffect, useRef } from 'react';

/** Duration of both the fade-in and the fade-out, in milliseconds. */
const FADE_DURATION_MS = 500;
/** Seconds remaining before `ended` at which the fade-out is armed. */
const FADE_OUT_LEAD_SECONDS = 0.55;
/** Pause at zero opacity after `ended`, before the video is rewound. */
const LOOP_RESET_DELAY_MS = 100;

type BackgroundVideoProps = {
  src: string;
  /** Vertical offset class. The top of the frame is cropped so the busier lower portion reads. */
  className?: string;
};

/**
 * Full-screen looping background video.
 *
 * The loop is driven manually rather than with the `loop` attribute: `loop`
 * suppresses the `ended` event, and `ended` is what the fade cycle hangs off.
 * Opacity is animated with requestAnimationFrame instead of a CSS transition so
 * a fade can be interrupted and resumed from wherever it currently sits.
 */
export default function BackgroundVideo({ src, className = '' }: BackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  /** Guards against `timeupdate` firing many times inside the fade-out window. */
  const fadingOutRef = useRef(false);

  const cancelFade = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  /** Animate opacity to `target`, starting from wherever the element is now. */
  const fadeTo = useCallback(
    (target: number) => {
      const video = videoRef.current;
      if (!video) return;

      cancelFade();

      const from = Number.parseFloat(video.style.opacity || '0');
      const delta = target - from;
      if (delta === 0) return;

      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - start) / FADE_DURATION_MS, 1);
        video.style.opacity = String(from + delta * t);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [cancelFade],
  );

  const handleLoadedData = useCallback(() => {
    fadingOutRef.current = false;
    fadeTo(1);
  }, [fadeTo]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || fadingOutRef.current) return;

    const { duration, currentTime } = video;
    if (!Number.isFinite(duration) || duration === 0) return;

    if (duration - currentTime <= FADE_OUT_LEAD_SECONDS) {
      fadingOutRef.current = true;
      fadeTo(0);
    }
  }, [fadeTo]);

  const handleEnded = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    cancelFade();
    video.style.opacity = '0';

    resetTimerRef.current = window.setTimeout(() => {
      video.currentTime = 0;
      void video.play().catch(() => {
        /* Autoplay can be refused while backgrounded; the poster frame stands in. */
      });
      fadingOutRef.current = false;
      fadeTo(1);
    }, LOOP_RESET_DELAY_MS);
  }, [cancelFade, fadeTo]);

  useEffect(
    () => () => {
      cancelFade();
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    },
    [cancelFade],
  );

  return (
    <video
      ref={videoRef}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
      style={{ opacity: 0 }}
      src={src}
      autoPlay
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
      onLoadedData={handleLoadedData}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
    />
  );
}
