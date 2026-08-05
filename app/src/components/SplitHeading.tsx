import type { CSSProperties } from 'react';

/** Seconds of delay added per word, per the 100ms-per-index stagger. */
const WORD_STAGGER_MS = 100;

type SplitHeadingProps = {
  text: string;
  /** Seconds to wait before the first word begins. */
  startDelay?: number;
  className?: string;
};

/**
 * Display heading that animates in a word at a time.
 *
 * Words are laid out with flex-wrap rather than `white-space: nowrap`, so the
 * line holds together whenever it fits and breaks cleanly when it does not —
 * which is what keeps the headline inside a 375px viewport.
 */
export default function SplitHeading({ text, startDelay = 0, className = '' }: SplitHeadingProps) {
  const words = text.split(' ');

  return (
    <h1
      className={`flex flex-wrap justify-center ${className}`}
      style={{ fontFamily: 'var(--font-display)', rowGap: '0.1em' }}
    >
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className="animate-word"
          style={
            {
              '--enter-delay': `${startDelay + (index * WORD_STAGGER_MS) / 1000}s`,
            } as CSSProperties
          }
        >
          {word}
        </span>
      ))}
    </h1>
  );
}
