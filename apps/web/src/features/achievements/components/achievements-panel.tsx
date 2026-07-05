import { LuCircleAlert, LuTrophy } from 'react-icons/lu';

import { Alert, AlertDescription, AlertTitle } from '@~/components/ui/alert';
import { Badge } from '@~/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@~/components/ui/card';
import { Skeleton } from '@~/components/ui/skeleton';

import { useAllAchievements } from '../hooks/use-all-achievements';
import { useMyAchievements } from '../hooks/use-my-achievements';

function AchievementsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LuTrophy className="size-5" />
          Achievements
        </CardTitle>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {['achievement-skeleton-1', 'achievement-skeleton-2', 'achievement-skeleton-3', 'achievement-skeleton-4'].map(
            (key) => (
              <div key={key} className="rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AchievementsPanel() {
  const { data: allAchievements, isPending: isPendingAll, error: errorAll } = useAllAchievements();
  const { data: myAchievements, isPending: isPendingMy, error: errorMy } = useMyAchievements();

  if (isPendingAll || isPendingMy) {
    return <AchievementsSkeleton />;
  }

  if (errorAll || errorMy) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LuTrophy className="size-5" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <LuCircleAlert className="size-4" />
            <AlertTitle>Error loading achievements</AlertTitle>
            <AlertDescription>
              {errorAll ? 'Failed to load achievement list. ' : ''}
              {errorMy ? 'Failed to load your achievements. ' : ''}
              Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const unlockedIds = new Set(myAchievements?.map((a) => a.id) ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LuTrophy className="size-5" />
          Achievements
        </CardTitle>
        <CardDescription>
          {myAchievements?.length ?? 0} of {allAchievements?.length ?? 0} unlocked
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {allAchievements?.map((achievement) => {
            const isUnlocked = unlockedIds.has(achievement.id);
            const userAchievement = myAchievements?.find((a) => a.id === achievement.id);

            return (
              <div
                key={achievement.id}
                className={`rounded-lg border p-4 transition-colors ${
                  isUnlocked ? 'border-primary bg-primary/5' : 'border-muted bg-muted/30 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{achievement.icon ?? '🏆'}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{achievement.label}</h3>
                      {isUnlocked ? <Badge variant="secondary">Unlocked</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{achievement.description}</p>
                    {isUnlocked && userAchievement ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Unlocked on {new Date(userAchievement.unlockedAt).toLocaleDateString()}
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
