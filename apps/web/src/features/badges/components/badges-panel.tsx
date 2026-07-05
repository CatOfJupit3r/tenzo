import { LuCircleAlert, LuAward } from 'react-icons/lu';

import { Alert, AlertDescription, AlertTitle } from '@~/components/ui/alert';
import { Badge } from '@~/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@~/components/ui/card';
import { Skeleton } from '@~/components/ui/skeleton';
import { useMyAchievements } from '@~/features/achievements/hooks/use-my-achievements';

import { useBadges } from '../hooks/use-badges';

function BadgesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LuAward className="size-5" />
          Badges
        </CardTitle>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            'badge-skeleton-1',
            'badge-skeleton-2',
            'badge-skeleton-3',
            'badge-skeleton-4',
            'badge-skeleton-5',
            'badge-skeleton-6',
          ].map((key) => (
            <div key={key} className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function BadgesPanel() {
  const { data: allBadges, isPending: isPendingBadges, error: errorBadges } = useBadges();
  const { data: myAchievements, isPending: isPendingAchievements, error: errorAchievements } = useMyAchievements();

  if (isPendingBadges || isPendingAchievements) {
    return <BadgesSkeleton />;
  }

  if (errorBadges || errorAchievements) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LuAward className="size-5" />
            Badges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <LuCircleAlert className="size-4" />
            <AlertTitle>Error loading badges</AlertTitle>
            <AlertDescription>
              {errorBadges ? 'Failed to load badge list. ' : ''}
              {errorAchievements ? 'Failed to load your achievements. ' : ''}
              Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const unlockedAchievementIds = new Set(myAchievements?.map((a) => a.id) ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LuAward className="size-5" />
          Badges
        </CardTitle>
        <CardDescription>Badges you can unlock through achievements</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {allBadges?.map((badge) => {
            const isUnlocked =
              !badge.requiresAchievement ||
              (badge.requiresAchievement && unlockedAchievementIds.has(badge.requiresAchievement as never));

            return (
              <div
                key={badge.id}
                className={`rounded-lg border p-4 transition-colors ${
                  isUnlocked ? 'border-primary bg-primary/5' : 'border-muted bg-muted/30 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{badge.icon ?? '🎖️'}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{badge.label}</h3>
                      {isUnlocked ? (
                        <Badge variant="secondary">Unlocked</Badge>
                      ) : (
                        <Badge variant="outline">Locked</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{badge.description}</p>
                    {!isUnlocked && badge.requiresAchievement ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Requires: {badge.requiresAchievement.replace(/_/g, ' ')} achievement
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
