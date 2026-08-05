/**
 * The RESONARE "R" monogram, lifted verbatim from the site's favicon.svg so the
 * mark stays identical across the static site and this app. The navy plate is
 * dropped here — over video the glyph reads in white with the accent dot.
 */

type ResonareMarkProps = {
  size?: number;
  className?: string;
};

export default function ResonareMark({ size = 24, className = '' }: ResonareMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="RESONARE"
    >
      <g transform="translate(7.194 52.867) scale(0.059451 -0.059451)" fill="currentColor">
        <path d="M420 0 274 265H233V0H62V702H349Q432 702 490.5 673.0Q549 644 578.0 593.5Q607 543 607 481Q607 411 567.5 356.0Q528 301 451 278L613 0ZM233 386H339Q386 386 409.5 409.0Q433 432 433 474Q433 514 409.5 537.0Q386 560 339 560H233Z" />
      </g>
      <circle cx="47.532" cy="44.717" r="5.588" fill="var(--brand-accent)" />
    </svg>
  );
}
