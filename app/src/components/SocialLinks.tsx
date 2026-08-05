import { Globe, Instagram, Twitter } from 'lucide-react';

const SOCIALS = [
  { label: 'RESONARE on Instagram', href: 'https://instagram.com/', Icon: Instagram },
  { label: 'RESONARE on Twitter', href: 'https://twitter.com/', Icon: Twitter },
  { label: 'resonare.digital', href: 'https://resonare.digital/', Icon: Globe },
] as const;

export default function SocialLinks() {
  return (
    <footer className="relative z-10 flex justify-center gap-4 pb-12">
      {SOCIALS.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          aria-label={label}
          target="_blank"
          rel="noreferrer noopener"
          className="liquid-glass rounded-full p-4 text-white/80 transition-all hover:bg-white/5 hover:text-white"
        >
          <Icon size={20} aria-hidden="true" />
        </a>
      ))}
    </footer>
  );
}
