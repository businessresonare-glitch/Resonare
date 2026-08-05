import type { CSSProperties } from 'react';
import { Globe, Instagram, Twitter } from 'lucide-react';

const SOCIALS = [
  { label: 'RESONARE on Instagram', href: 'https://instagram.com/', Icon: Instagram },
  { label: 'RESONARE on Twitter', href: 'https://twitter.com/', Icon: Twitter },
  { label: 'resonare.digital', href: 'https://resonare.digital/', Icon: Globe },
] as const;

/** Socials land last, after the hero content has settled. */
const SOCIALS_ENTER_DELAY = 0.72;
const STAGGER_STEP = 0.09;

export default function SocialLinks() {
  return (
    <footer className="relative z-10 flex justify-center gap-4 pb-12">
      {SOCIALS.map(({ label, href, Icon }, index) => (
        <a
          key={label}
          href={href}
          aria-label={label}
          target="_blank"
          rel="noreferrer noopener"
          style={
            { '--enter-delay': `${SOCIALS_ENTER_DELAY + index * STAGGER_STEP}s` } as CSSProperties
          }
          className="liquid-glass animate-enter hover-lift rounded-full p-4 text-white/80 hover:bg-white/5 hover:text-white"
        >
          <Icon size={20} aria-hidden="true" />
        </a>
      ))}
    </footer>
  );
}
