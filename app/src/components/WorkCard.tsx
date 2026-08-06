import type { CSSProperties } from 'react';
import type { Project } from '../work';

type WorkCardProps = {
  project: Project;
  /** Seconds before this card's entrance begins. */
  delay: number;
  /** When false, the card holds at opacity 0 until the observer fires. */
  active: boolean;
};

export default function WorkCard({ project, delay, active }: WorkCardProps) {
  const enterDelay = { '--enter-delay': `${delay}s` } as CSSProperties;

  return (
    <article
      style={enterDelay}
      className={`card-hover group ${active ? 'animate-enter' : 'pre-enter'}`}
    >
      <div className="liquid-glass overflow-hidden rounded-none">
        <div className="overflow-hidden">
          <img
            src={project.src}
            alt={project.alt}
            width={project.width}
            height={project.height}
            loading="lazy"
            decoding="async"
            style={enterDelay}
            className={`card-media block h-auto w-full ${active ? 'animate-media' : 'pre-enter'}`}
          />
        </div>

        <div className="p-6 text-left">
          {/* Technical label — the one place the mono face earns its download. */}
          <p
            className="mb-3 text-xs uppercase text-white/60"
            style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, letterSpacing: '0.1em' }}
          >
            {project.tag}
          </p>
          {/* No weight utility here: Instrument Serif ships 400 only, and a
              font-semibold would make the browser synthesise a fake bold. */}
          <h3 className="mb-2 text-2xl text-white">{project.title}</h3>
          <p className="text-pretty text-sm leading-relaxed text-white/70">{project.blurb}</p>
        </div>
      </div>
    </article>
  );
}
