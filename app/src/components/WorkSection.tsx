import type { CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import SplitHeading from './SplitHeading';
import WorkCard from './WorkCard';
import useInView from '../useInView';
import { PROJECTS } from '../work';
import { SITE_PATHS, siteUrl } from '../siteLinks';

/** Per-card stagger, per the brief's 0.09s step. */
const STAGGER_STEP = 0.09;
/** Cards begin after the section heading has finished landing. */
const GRID_START_DELAY = 0.35;

export default function WorkSection() {
  const { ref, inView } = useInView<HTMLElement>();

  return (
    <section ref={ref} className="relative z-10 bg-black px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div
          style={{ '--enter-delay': '0s' } as CSSProperties}
          className={`mb-4 h-px w-full bg-white/20 ${inView ? 'animate-line' : 'pre-enter'}`}
          aria-hidden="true"
        />

        <SplitHeading
          as="h2"
          text="Real sites, built for real trade businesses"
          active={inView}
          startDelay={0.1}
          className="mb-4 text-3xl tracking-tight text-white md:text-4xl lg:text-5xl"
        />

        <p
          style={{ '--enter-delay': '0.25s' } as CSSProperties}
          className={`mx-auto mb-14 max-w-2xl text-pretty text-center text-sm leading-relaxed text-white/70 ${
            inView ? 'animate-enter' : 'pre-enter'
          }`}
        >
          Every project below is a live, working website — not a mockup. See the range across
          plumbing, fencing, and electrical.
        </p>

        <div className="grid gap-8 md:grid-cols-2">
          {PROJECTS.map((project, index) => (
            <WorkCard
              key={project.src}
              project={project}
              active={inView}
              delay={GRID_START_DELAY + index * STAGGER_STEP}
            />
          ))}
        </div>

        <div className="mt-14 flex justify-center">
          <a
            href={siteUrl(SITE_PATHS.work)}
            style={
              {
                '--enter-delay': `${GRID_START_DELAY + PROJECTS.length * STAGGER_STEP}s`,
              } as CSSProperties
            }
            className={`liquid-glass hover-lift group inline-flex min-h-[44px] items-center gap-2 rounded-full px-8 py-3 text-sm font-medium text-white hover:bg-white/5 ${
              inView ? 'animate-enter' : 'pre-enter'
            }`}
          >
            View all projects
            <ArrowRight
              size={16}
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-[3px]"
            />
          </a>
        </div>
      </div>
    </section>
  );
}
