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
          <p
            className="mb-3 text-xs font-semibold uppercase text-white/60"
            style={{ letterSpacing: '0.1em' }}
          >
            {project.tag}
          </p>
          <h3 className="mb-2 text-xl font-semibold text-white">{project.title}</h3>
          <p className="text-sm leading-relaxed text-white/70">{project.blurb}</p>
        </div>
      </div>
    </article>
  );
}
