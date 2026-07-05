import { Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { LuArrowLeft, LuTriangleAlert } from 'react-icons/lu';
import z from 'zod';

import Loader from '@~/components/loader';
import { Alert, AlertDescription } from '@~/components/ui/alert';
import { Button } from '@~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@~/components/ui/card';
import { useAppForm } from '@~/components/ui/field';
import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@~/components/ui/tabs';

import { useMe } from '../hooks/use-me';
import { useUpdateUserProfile } from '../hooks/use-update-user-profile';
import { useUserProfile } from '../hooks/use-user-profile';
import { AvatarWithBadge } from './avatar-with-badge';
import { BadgePicker } from './badge-picker';

export function SettingsView() {
  const { user } = useMe();
  const { data: profile, isPending: isProfileLoading } = useUserProfile();
  const { updateUserProfile, isPending } = useUpdateUserProfile();
  const [isDeleteConfirmShown, setIsDeleteConfirmShown] = useState(false);

  const form = useAppForm({
    defaultValues: {
      bio: profile?.bio ?? '',
    },
    onSubmit: async ({ value }) => {
      updateUserProfile({ bio: value.bio });
    },
    validators: {
      onSubmit: z.object({
        bio: z.string().max(500, 'Bio must be 500 characters or less'),
      }),
    },
  });

  useEffect(() => {
    if (profile?.bio) {
      form.setFieldValue('bio', profile.bio);
    }
  }, [profile?.bio, form]);

  if (isProfileLoading) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <Loader />
      </div>
    );
  }

  const handleDeleteAccount = async () => {
    // TODO: Implement delete account functionality
    console.log('[Settings] Delete account requested');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
              <p className="mt-1 text-muted-foreground">Manage your account settings</p>
            </div>
            <Link to="/profile">
              <Button variant="ghost" size="sm" className="gap-2">
                <LuArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="danger">Danger Zone</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-6 space-y-4">
            <form.AppForm>
              <form.Form className="space-y-4 p-0 md:p-0">
                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Link to="/profile" className="flex-1">
                    <Button variant="outline" className="w-full">
                      Cancel
                    </Button>
                  </Link>
                  <form.SubmitButton className="flex-1" isDisabled={isPending}>
                    {isPending ? 'Saving...' : 'Save Changes'}
                  </form.SubmitButton>
                </div>

                {/* Profile Picture Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Profile Picture</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-4">
                    <AvatarWithBadge
                      imageUrl={user?.image}
                      fallback={user?.name?.[0] ?? user?.username?.[0] ?? 'U'}
                      selectedBadge={profile?.selectedBadge}
                      size="lg"
                    />
                    <Button variant="outline" disabled>
                      Change Picture
                    </Button>
                    <p className="text-xs text-muted-foreground">Coming soon</p>
                  </CardContent>
                </Card>

                {/* Account Information Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Account Information</CardTitle>
                    <CardDescription className="text-xs">
                      These fields are managed by your authentication provider
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label htmlFor="email" className="text-xs font-medium">
                        Email
                      </Label>
                      <Input id="email" type="email" value={user?.email ?? ''} disabled className="mt-1.5 text-sm" />
                    </div>
                    <div>
                      <Label htmlFor="username" className="text-xs font-medium">
                        Username
                      </Label>
                      <Input id="username" value={user?.username ?? ''} disabled className="mt-1.5 text-sm" />
                    </div>
                  </CardContent>
                </Card>

                {/* Profile Details Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Profile Details</CardTitle>
                    <CardDescription className="text-xs">Customize how you appear to other users</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <form.AppField name="bio">
                      {(field) => (
                        <field.TextareaField
                          label="Bio"
                          placeholder="Tell others about yourself..."
                          maxLength={500}
                          rows={4}
                          description={`${field.state.value.length}/500 characters`}
                        />
                      )}
                    </form.AppField>
                  </CardContent>
                </Card>

                {/* Badge Picker Section */}
                <BadgePicker />
              </form.Form>
            </form.AppForm>
          </TabsContent>

          {/* Danger Zone Tab */}
          <TabsContent value="danger" className="mt-6">
            <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-red-900 dark:text-red-400">
                  <LuTriangleAlert className="h-5 w-5" />
                  Delete Account
                </CardTitle>
                <CardDescription className="text-xs text-red-800 dark:text-red-300">
                  This action cannot be undone. Please be certain before proceeding.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <LuTriangleAlert />
                  <AlertDescription className="text-sm">
                    Deleting your account will permanently remove all your profile data, challenges you created, and
                    challenge participation records. This cannot be reversed.
                  </AlertDescription>
                </Alert>

                {!isDeleteConfirmShown ? (
                  <Button variant="destructive" onClick={() => setIsDeleteConfirmShown(true)} className="w-full">
                    Delete My Account
                  </Button>
                ) : (
                  <div className="space-y-3 pt-2">
                    <p className="text-sm font-medium text-foreground">
                      Are you absolutely sure? This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsDeleteConfirmShown(false)} className="flex-1">
                        Cancel
                      </Button>
                      <Button variant="destructive" onClick={handleDeleteAccount} className="flex-1">
                        Permanently Delete
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
