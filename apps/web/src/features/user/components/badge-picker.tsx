import { LuAward, LuCheck, LuLock } from 'react-icons/lu';

import { Alert, AlertDescription, AlertTitle } from '@~/components/ui/alert';
import { Button } from '@~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@~/components/ui/card';
import { Skeleton } from '@~/components/ui/skeleton';
import { useMyAchievements } from '@~/features/achievements/hooks/use-my-achievements';
import { useBadges } from '@~/features/badges/hooks/use-badges';

import { useUpdateUserBadge } from '../hooks/use-update-user-badge';
import { useUserProfile } from '../hooks/use-user-profile';

function BadgePickerSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LuAward className="size-5" />
          Select Your Badge
        </CardTitle>
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function BadgePicker() {
  const { data: badges, isPending: isPendingBadges, error: errorBadges } = useBadges();
  const { data: profile, isPending: isPendingProfile } = useUserProfile();
  const { data: myAchievements, isPending: isPendingAchievements } = useMyAchievements();
  const { updateUserBadge, isPending } = useUpdateUserBadge();

  if (isPendingBadges || isPendingProfile || isPendingAchievements) {
    return <BadgePickerSkeleton />;
  }

  if (errorBadges) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LuAward className="size-5" />
            Select Your Badge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Error loading badges</AlertTitle>
            <AlertDescription>Failed to load badge list. Please try again later.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const unlockedAchievementIds = new Set(myAchievements?.map((a) => a.id) ?? []);
  const selectedBadge = profile?.selectedBadge;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LuAward className="size-5" />
          Select Your Badge
        </CardTitle>
        <CardDescription>
          Choose a badge to display on your profile. Some badges require achievements to unlock.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges?.map((badge) => {
            const isUnlocked =
              !badge.requiresAchievement ||
              (badge.requiresAchievement && unlockedAchievementIds.has(badge.requiresAchievement as never));
            const isSelected = selectedBadge === badge.id;

            return (
              <Button
                key={badge.id}
                variant={isSelected ? 'default' : 'outline'}
                className={`relative h-auto justify-start gap-3 p-4 ${
                  !isUnlocked ? 'cursor-not-allowed opacity-50' : ''
                }`}
                disabled={!isUnlocked || isPending}
                onClick={() => {
                  if (isUnlocked) {
                    updateUserBadge({ badgeId: badge.id });
                  }
                }}
              >
                <div className="text-2xl">{badge.icon ?? '🎖️'}</div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{badge.label}</span>
                    {!isUnlocked && <LuLock className="size-3" />}
                    {isSelected ? <LuCheck className="size-4" /> : null}
                  </div>
                  <p className="text-xs text-wrap opacity-80">{badge.description}</p>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
