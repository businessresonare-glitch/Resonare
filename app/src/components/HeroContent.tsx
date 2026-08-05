import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';

const HEADING_FONT = "'Instrument Serif', serif";

export default function HeroContent() {
  const [email, setEmail] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Wire to your list provider here — no endpoint is hardcoded in the client.
  };

  return (
    <main className="relative z-10 flex flex-1 -translate-y-[20%] flex-col items-center justify-center px-6 py-12 text-center">
      <h1
        className="mb-8 whitespace-normal text-5xl tracking-tight text-white md:whitespace-nowrap md:text-6xl lg:text-7xl"
        style={{ fontFamily: HEADING_FONT }}
      >
        Web design that resonates
      </h1>

      <div className="w-full max-w-xl space-y-4">
        <form
          onSubmit={handleSubmit}
          className="liquid-glass flex items-center gap-3 rounded-full py-2 pl-6 pr-2"
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
            className="shrink-0 rounded-full bg-white p-3 text-black transition-transform hover:scale-105 active:scale-95"
          >
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </form>

        <p className="px-4 text-sm leading-relaxed text-white">
          High-impact websites, booking systems, and SEO-driven identities for ambitious local and
          trade businesses. Leave your email and we will send the work that proves it.
        </p>
      </div>

      <button
        type="button"
        className="liquid-glass mt-4 rounded-full px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-white/5"
      >
        Read the manifesto
      </button>
    </main>
  );
}
