import type { CSSProperties } from 'react';

/** Seconds of delay added per word, per the 100ms-per-index stagger. */
const WORD_STAGGER_MS = 100;

type SplitHeadingProps = {
  text: string;
  /** Seconds to wait before the first word begins. */
  startDelay?: number;
  className?: string;
  /** Heading level. The hero owns h1; sections below should pass h2. */
  as?: 'h1' | 'h2';
  /** When false, words hold at opacity 0 until the viewport observer fires. */
  active?: boolean;
};

/**
 * Display heading that animates in a word at a time.
 *
 * Words are laid out with flex-wrap rather than `white-space: nowrap`, so the
 * line holds together whenever it fits and breaks cleanly when it does not —
 * which is what keeps the headline inside a 375px viewport.
 */
export default function SplitHeading({
  text,
  startDelay = 0,
  className = '',
  as: Tag = 'h1',
  active = true,
}: SplitHeadingProps) {
  const words = text.split(' ');

  return (
    <Tag
      className={`flex flex-wrap justify-center ${className}`}
      style={{ fontFamily: 'var(--font-display)', rowGap: '0.1em' }}
    >
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className={`word ${active ? 'animate-word' : 'pre-enter'}`}
          style={
            {
              '--enter-delay': `${startDelay + (index * WORD_STAGGER_MS) / 1000}s`,
            } as CSSProperties
          }
        >
          {word}
        </span>
      ))}
    </Tag>
  );
}
