import { Link } from '@tanstack/react-router';
import { LuHouse } from 'react-icons/lu';

import { useMe } from '@~/features/user';

import { ModeToggle } from './mode-toggle';
import { Logo } from './ui/logo';
import UserMenu from './user-menu';

const HEADER_LINKS = [{ to: '/dashboard', label: 'Dashboard', authRequired: true, icon: LuHouse }] as const;

export default function Header() {
  const { isLoggedIn } = useMe();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo Section - Left */}
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold transition-opacity hover:opacity-80">
            <Logo className="size-6 text-primary" />
            <span className="hidden sm:inline-block">startername</span>
          </Link>
        </div>

        {/* Navigation Links - Center */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 transform gap-6 md:flex">
          {HEADER_LINKS.map(({ to, label, authRequired, icon: Icon }) => {
            if (authRequired && !isLoggedIn) return null;
            return (
              <Link
                key={to}
                to={to}
                className="w-32 rounded-md px-2 py-1 text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-foreground data-[status=active]:font-semibold data-[status=active]:text-background"
              >
                <Icon className="mr-1 mb-0.5 inline-block size-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User Menu - Right */}
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
