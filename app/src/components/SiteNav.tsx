import ResonareMark from './ResonareMark';

const NAV_LINKS = [
  { label: 'Services', href: '/services.html' },
  { label: 'Our Work', href: '/work.html' },
  { label: 'About', href: '/about.html' },
] as const;

export default function SiteNav() {
  return (
    <header className="relative z-20 pl-6 pr-6 py-6">
      <nav
        className="mx-auto flex max-w-5xl items-center justify-between rounded-full px-6 py-3"
        aria-label="Main navigation"
      >
        <div className="flex items-center gap-8">
          <a
            href="/"
            className="flex min-h-[44px] items-center gap-2 text-white md:min-h-0"
            aria-label="RESONARE home"
          >
            <ResonareMark size={24} />
            <span className="text-lg font-semibold">Resonare</span>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-white/80 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Secondary CTA is dropped below md so it cannot crowd the mark. */}
          <a
            href="/contact.html"
            className="hidden min-h-[44px] items-center whitespace-nowrap text-sm font-medium text-white transition-colors hover:text-white/80 md:inline-flex md:min-h-0"
          >
            Get a quote
          </a>
          <a
            href="/contact.html"
            className="liquid-glass inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-white/5 md:min-h-0"
          >
            Start a project
          </a>
        </div>
      </nav>
    </header>
  );
}
