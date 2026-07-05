import { Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { LuArrowLeft } from 'react-icons/lu';
import z from 'zod';

import Loader from '@~/components/loader';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@~/components/ui/breadcrumb';
import { Button } from '@~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@~/components/ui/card';
import { useAppForm } from '@~/components/ui/field';
import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';

import { useMe } from '../hooks/use-me';
import { useUpdateUserProfile } from '../hooks/use-update-user-profile';
import { useUserProfile } from '../hooks/use-user-profile';

export function ProfileEditForm() {
  const { user } = useMe();
  const { data: profile, isPending: isProfileLoading } = useUserProfile();
  const { updateUserProfile, isPending } = useUpdateUserProfile();

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
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/profile">Profile</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Edit Profile</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Edit Profile</h1>
              <p className="mt-1 text-muted-foreground">Update your profile information</p>
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
        <form.AppForm>
          <form.Form className="space-y-4 p-0 md:p-0">
            {/* Account Information */}
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

            {/* Profile Details */}
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
                      placeholder="Tell us about yourself..."
                      maxLength={500}
                      rows={4}
                      description={`${field.state.value.length}/500 characters`}
                    />
                  )}
                </form.AppField>
              </CardContent>
            </Card>

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
          </form.Form>
        </form.AppForm>
      </div>
    </div>
  );
}
