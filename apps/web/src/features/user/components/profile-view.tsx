import { Link } from '@tanstack/react-router';
import { LuCalendar, LuTrophy, LuSettings } from 'react-icons/lu';

import Loader from '@~/components/loader';
import { Button } from '@~/components/ui/button';
import { Card, CardContent } from '@~/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@~/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@~/components/ui/tabs';

import { useMe } from '../hooks/use-me';
import { useUserProfile } from '../hooks/use-user-profile';
import { AvatarWithBadge } from './avatar-with-badge';
import { PublicCodeCard } from './invite-code-card';

export function ProfileView() {
  const { user } = useMe();
  const { data: profile, isPending: isProfileLoading } = useUserProfile();

  if (isProfileLoading) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Profile Header Card */}
        <Card className="mb-6">
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              {/* Left - User Info */}
              <div className="flex gap-4">
                <AvatarWithBadge
                  imageUrl={user?.image}
                  fallback={user?.name?.[0] ?? user?.username?.[0] ?? 'U'}
                  selectedBadge={profile?.selectedBadge}
                  size="lg"
                />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{user?.name || user?.username}</h1>
                  <p className="text-muted-foreground">@{user?.username}</p>
                  {profile?.bio ? <p className="mt-2 text-sm text-muted-foreground">{profile.bio}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {user?.createdAt ? (
                      <div className="flex items-center gap-1">
                        <LuCalendar className="size-3" />
                        Joined{' '}
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to="/settings">
                  <Button variant="outline" size="sm" className="gap-2">
                    <LuSettings className="size-4" />
                    <span className="hidden sm:inline">Settings</span>
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Public Code Card */}
        {profile?.publicCode ? (
          <div className="mb-6">
            <PublicCodeCard publicCode={profile.publicCode} />
          </div>
        ) : null}

        {/* Tabs */}
        <Tabs defaultValue="achievements" className="w-full">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
          </TabsList>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="mt-4">
            <Empty className="border border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LuTrophy className="size-6" />
                </EmptyMedia>
                <EmptyTitle>Achievements</EmptyTitle>
                <EmptyDescription>Complete more challenges to unlock achievements!</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
