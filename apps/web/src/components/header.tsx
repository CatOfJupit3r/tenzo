import { Link } from '@tanstack/react-router';

import { ModeToggle } from './mode-toggle';
import { Logo } from './ui/logo';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold transition-opacity hover:opacity-80">
            <Logo className="size-6 text-primary" />
            <span className="hidden sm:inline-block">Character Card Creator</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
