/**
 * Live client projects. Copy and imagery are lifted verbatim from work.html on
 * the static site — these are real shipped sites, not placeholders.
 */
export type Project = {
  tag: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  title: string;
  blurb: string;
};

export const PROJECTS: Project[] = [
  {
    tag: 'Plumbing · Featured',
    src: '/work/usa-plumbing.jpg',
    alt: 'USA Plumbing Service & Rooter website homepage',
    width: 1600,
    height: 916,
    title: 'USA Plumbing Service & Rooter',
    blurb:
      'A same-day-service rebuild for a family-owned Rancho Cucamonga plumber, with upfront-pricing trust badges, a 4.9-star review callout, and a rust-and-cream palette that matches the trucks.',
  },
  {
    tag: 'Fencing · UK',
    src: '/work/greenfellas.jpg',
    alt: 'GreenFellas Garden Fencing website homepage',
    width: 1600,
    height: 916,
    title: 'GreenFellas Garden Fencing',
    blurb:
      'Green-themed identity for a North London fence contractor, with an animated fence-post hero graphic, a 10-year guarantee, and a live stat row proving track record.',
  },
  {
    tag: 'Plumbing · UK',
    src: '/work/london-plumbers.jpg',
    alt: 'London Plumbers website homepage',
    width: 1600,
    height: 916,
    title: 'London Plumbers',
    blurb:
      'An emergency call-out site for a Gas Safe registered Ealing plumber, built around a 60-minute response promise, a live pipe-network diagram, and a floating WhatsApp chat button.',
  },
  {
    tag: 'Electrical · Nepal',
    src: '/work/electrical-nepal.jpg',
    alt: 'Electrical Services Nepal website homepage',
    width: 1600,
    height: 916,
    title: 'Electrical Services Nepal',
    blurb:
      'A bold gold-on-navy identity for a 24-hour Kathmandu electrician, with an always-available status pill and a direct emergency line as the single clear call to action.',
  },
  {
    tag: 'Electrical & Plumbing · Malaysia',
    src: '/work/mk-electrician.jpg',
    alt: 'MK Electrician & Plumber website homepage',
    width: 1600,
    height: 916,
    title: 'MK Electrician & Plumber',
    blurb:
      'A dual-trade brand for a Kuala Lumpur team licensed in both electrical and plumbing work, with a same-day one-call promise and a WhatsApp-first quote flow.',
  },
];
