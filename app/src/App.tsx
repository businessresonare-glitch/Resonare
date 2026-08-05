import BackgroundVideo from './components/BackgroundVideo';
import HeroContent from './components/HeroContent';
import SiteNav from './components/SiteNav';
import SocialLinks from './components/SocialLinks';

/**
 * Public CDN asset, not a secret — so it ships as a working default and
 * VITE_HERO_VIDEO_URL overrides it per environment. See .env.example.
 */
const DEFAULT_HERO_VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4';

const HERO_VIDEO_URL = import.meta.env.VITE_HERO_VIDEO_URL || DEFAULT_HERO_VIDEO_URL;

export default function App() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-black">
      <BackgroundVideo src={HERO_VIDEO_URL} className="translate-y-[17%]" />
      <SiteNav />
      <HeroContent />
      <SocialLinks />
    </div>
  );
}
