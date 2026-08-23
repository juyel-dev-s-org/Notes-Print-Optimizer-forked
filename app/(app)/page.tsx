import { LandingHero } from '@/components/LandingHero';
import { ToolsBox } from '@/components/tools/ToolsBox';

/**
 * Landing route — server-rendered hero + crawlable tool links.
 * The interactive shell chrome comes from the persistent group layout;
 * tool cards are real <Link>s into /tools/<slug>/.
 */
export default function HomePage() {
  return (
    <div className="animate-enter flex w-full max-w-full min-w-0 flex-col gap-5 md:gap-6">
      <LandingHero />
      <ToolsBox />
    </div>
  );
}
