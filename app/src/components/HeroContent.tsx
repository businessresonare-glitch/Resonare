import { useState, type CSSProperties, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import SplitHeading from './SplitHeading';

const HEADLINE = 'Web design that resonates';
/** Headline words finish staggering before the supporting content enters. */
const CONTENT_ENTER_DELAY = 0.45;
const STAGGER_STEP = 0.09;

const delay = (index: number): CSSProperties =>
  ({ '--enter-delay': `${CONTENT_ENTER_DELAY + index * STAGGER_STEP}s` }) as CSSProperties;

export default function HeroContent() {
  const [email, setEmail] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Wire to your list provider here — no endpoint is hardcoded in the client.
  };

  return (
    <main className="relative z-10 flex flex-1 -translate-y-[20%] flex-col items-center justify-center px-6 py-12 text-center">
      <SplitHeading
        text={HEADLINE}
        startDelay={0.15}
        className="mb-8 text-5xl tracking-tight text-white md:text-6xl lg:text-7xl"
      />

      <div className="w-full max-w-xl space-y-4">
        <form
          onSubmit={handleSubmit}
          style={delay(0)}
          className="liquid-glass animate-enter flex items-center gap-3 rounded-full py-2 pl-6 pr-2"
        >
          <input
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            aria-label="Email address"
            autoComplete="email"
            required
            // h-11 matches the 44px submit button, so the tap target grows without
            // changing the bar's rendered height.
            className="h-11 min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-white/40 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Submit email address"
            className="hover-lift shrink-0 rounded-full bg-white p-3 text-black"
          >
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </form>

        <p style={delay(1)} className="animate-enter text-pretty px-4 text-sm leading-relaxed text-white">
          High-impact websites, booking systems, and SEO-driven identities for ambitious local and
          trade businesses. Leave your email and we will send the work that proves it.
        </p>
      </div>

      <button
        type="button"
        style={delay(2)}
        className="liquid-glass animate-enter hover-lift mt-4 rounded-full px-8 py-3 text-sm font-medium text-white hover:bg-white/5"
      >
        Read the manifesto
      </button>
    </main>
  );
}
