import type { BadgeId } from '@startername/shared/constants/badges';

import { Avatar, AvatarFallback, AvatarImage } from '@~/components/ui/avatar';
import { useBadges } from '@~/features/badges/hooks/use-badges';

interface iAvatarWithBadgeProps {
  imageUrl?: string | null;
  fallback: string;
  selectedBadge?: BadgeId | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

const badgeOverlaySizeClasses = {
  sm: 'h-4 w-4 text-xs',
  md: 'h-5 w-5 text-sm',
  lg: 'h-6 w-6 text-base',
};

export function AvatarWithBadge({
  imageUrl,
  fallback,
  selectedBadge,
  size = 'md',
  className = '',
}: iAvatarWithBadgeProps) {
  const { data: badges } = useBadges();

  const badge = badges?.find((b) => b.id === selectedBadge);
  const badgeIcon = badge?.icon ?? null;

  return (
    <div className={`relative ${className}`}>
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={imageUrl ?? '/placeholder.svg'} />
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      {badgeIcon ? (
        <div
          className={`absolute -right-1 -bottom-1 flex items-center justify-center rounded-full border-2 border-background bg-background shadow-sm ${badgeOverlaySizeClasses[size]}`}
          title={badge?.label ?? 'Badge'}
          aria-label={badge?.label ?? 'User badge'}
        >
          <span className="leading-none">{badgeIcon}</span>
        </div>
      ) : null}
    </div>
  );
}
