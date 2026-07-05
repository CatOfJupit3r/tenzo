# Feature Implementation Examples

Complete examples showing the full lifecycle of feature implementation.

## Example 1: User Profile Feature

### Models (Typegoose)

```typescript
// apps/server/src/db/models/user-profile.model.ts
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import type { DocumentType } from '@typegoose/typegoose';
import { idProp } from '../prop';

@modelOptions({
  schemaOptions: {
    collection: 'user_profiles',
    timestamps: true,
  },
  options: {
    indexes: [{ userId: 1 }],
  },
})
class UserProfileClass {
  @idProp()
  public _id!: string;

  @prop({ required: true, unique: true, index: true })
  public userId!: string;

  @prop({ default: '' })
  public bio!: string;

  @prop({ default: '' })
  public avatarUrl!: string;

  @prop({ type: () => [String], default: [] })
  public interests!: string[];

  public createdAt!: Date;
  public updatedAt!: Date;
}

export const UserProfileModel = getModelForClass(UserProfileClass);
export type UserProfileDoc = DocumentType<UserProfileClass>;
```

### Contract (oRPC)

```typescript
// packages/shared/src/contract/user-profile.contract.ts
import { oc } from '@orpc/server';
import z from 'zod';
import { authProcedure } from './base';

const userProfileSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  bio: z.string(),
  avatarUrl: z.string(),
  interests: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const userProfileContract = oc.router({
  getProfile: oc
    .route({
      method: 'GET',
      path: '/user-profile/:userId',
      summary: 'Get user profile by user ID',
    })
    .input(z.object({ userId: z.string() }))
    .output(userProfileSchema)
    .use(authProcedure),

  updateProfile: oc
    .route({
      method: 'PUT',
      path: '/user-profile',
      summary: 'Update current user profile',
    })
    .input(
      z.object({
        bio: z.string().max(500).optional(),
        avatarUrl: z.string().url().optional(),
        interests: z.array(z.string()).max(10).optional(),
      })
    )
    .output(userProfileSchema)
    .use(authProcedure),
});
```

### Service (DI)

```typescript
// apps/server/src/features/user-profile/user-profile.service.ts
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '@~/di/tokens';
import type { iLogger } from '@~/di/tokens';
import { UserProfileModel } from '@~/db/models/user-profile.model';
import { ORPCNotFoundError } from '@~/lib/orpc-error-wrapper';
import { ERROR_CODES } from '@startername/shared/enums/errors';

@injectable()
export class UserProfileService {
  private readonly logger: iLogger;

  constructor(@inject(TOKENS.LoggerFactory) loggerFactory: () => iLogger) {
    this.logger = loggerFactory();
  }

  public async getProfile(userId: string) {
    const profile = await UserProfileModel.findOne({ userId });
    
    if (!profile) {
      throw ORPCNotFoundError(ERROR_CODES.PROFILE_NOT_FOUND);
    }

    return profile;
  }

  public async updateProfile(userId: string, updates: Partial<UserProfile>) {
    const profile = await UserProfileModel.findOneAndUpdate(
      { userId },
      { $set: updates },
      { new: true, upsert: true }
    );

    this.logger.info('Profile updated', { userId });

    return profile;
  }
}
```

### Router Implementation

```typescript
// apps/server/src/routers/user-profile.router.ts
import { protectedProcedure } from '@~/lib/orpc';
import { base } from './base';
import { userProfileContract } from '@startername/shared/contract';
import { resolve } from '@~/di';
import { TOKENS } from '@~/di/tokens';

export const userProfileRouter = base.userProfile.router({
  getProfile: protectedProcedure
    .use(userProfileContract.getProfile)
    .handler(async ({ input, context }) => {
      const service = resolve(TOKENS.UserProfileService);
      return await service.getProfile(input.userId);
    }),

  updateProfile: protectedProcedure
    .use(userProfileContract.updateProfile)
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const service = resolve(TOKENS.UserProfileService);
      return await service.updateProfile(userId, input);
    }),
});
```

### Frontend Query Hook

```typescript
// apps/web/src/features/user-profile/hooks/use-user-profile.ts
import { useQuery } from '@tanstack/react-query';
import { tanstackRPC } from '@~/utils/tanstack-orpc';
import type { ORPCOutputs } from '@~/utils/orpc';

export const userProfileQueryOptions = (userId: string) =>
  tanstackRPC.userProfile.getProfile.queryOptions({
    input: { userId },
  });

export type UserProfileQueryReturnType = ORPCOutputs['userProfile']['getProfile'];

export function useUserProfile(userId: string) {
  return useQuery(userProfileQueryOptions(userId));
}
```

### Frontend Mutation Hook

```typescript
// apps/web/src/features/user-profile/hooks/use-update-profile.ts
import { useMutation } from '@tanstack/react-query';
import { tanstackRPC } from '@~/utils/tanstack-orpc';
import { toast } from 'sonner';
import { userProfileQueryOptions, type UserProfileQueryReturnType } from './use-user-profile';

export const updateProfileMutationOptions = tanstackRPC.userProfile.updateProfile.mutationOptions({
  async onMutate({ params: { bio, avatarUrl, interests } }, ctx) {
    const userId = ctx.client.getQueryData(['session'])?.user?.id;
    if (!userId) return;

    const key = userProfileQueryOptions(userId).queryKey;
    await ctx.client.cancelQueries({ queryKey: key });

    const previous = ctx.client.getQueryData<UserProfileQueryReturnType>(key);

    ctx.client.setQueryData<UserProfileQueryReturnType>(key, (oldData) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(interests !== undefined && { interests }),
      };
    });

    return { previous, userId };
  },

  onError: (_error, _variables, context, ctx) => {
    if (context?.previous && context?.userId) {
      const key = userProfileQueryOptions(context.userId).queryKey;
      ctx.client.setQueryData<UserProfileQueryReturnType>(key, context.previous);
    }
    toast.error('Failed to update profile');
  },

  onSuccess: (data, _variables, context, ctx) => {
    if (context?.userId) {
      const key = userProfileQueryOptions(context.userId).queryKey;
      ctx.client.setQueryData<UserProfileQueryReturnType>(key, data);
    }
    toast.success('Profile updated successfully');
  },
});

export function useUpdateProfile() {
  const { mutate: updateProfile, isPending } = useMutation(updateProfileMutationOptions);

  return {
    updateProfile,
    isPending,
  };
}
```

### Frontend Component

```typescript
// apps/web/src/features/user-profile/components/profile-edit-form.tsx
import { useAppForm } from '@~/components/ui/field';
import { Button } from '@~/components/ui/button';
import { useUpdateProfile } from '../hooks/use-update-profile';
import { useUserProfile } from '../hooks/use-user-profile';
import z from 'zod';

const profileFormSchema = z.object({
  bio: z.string().max(500, 'Bio must be 500 characters or less'),
  avatarUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  interests: z.array(z.string()).max(10, 'Maximum 10 interests'),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export function ProfileEditForm({ userId }: { userId: string }) {
  const { data: profile, isLoading } = useUserProfile(userId);
  const { updateProfile, isPending } = useUpdateProfile();

  const form = useAppForm<ProfileFormData>({
    defaultValues: {
      bio: profile?.bio ?? '',
      avatarUrl: profile?.avatarUrl ?? '',
      interests: profile?.interests ?? [],
    },
    validators: {
      onSubmit: profileFormSchema,
    },
    onSubmit: async ({ value }) => {
      updateProfile(value);
    },
  });

  if (isLoading) {
    return <div>Loading profile...</div>;
  }

  return (
    <form.AppForm>
      <form.Form className="space-y-4">
        <form.AppField name="bio">
          {(field) => (
            <field.TextareaField
              label="Bio"
              placeholder="Tell us about yourself"
              rows={4}
            />
          )}
        </form.AppField>

        <form.AppField name="avatarUrl">
          {(field) => (
            <field.TextField
              label="Avatar URL"
              placeholder="https://example.com/avatar.jpg"
            />
          )}
        </form.AppField>

        <form.SubmitButton disabled={isPending}>
          {isPending ? 'Saving...' : 'Save changes'}
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  );
}
```

## Example 2: Simpler CRUD Feature

For simpler features without services, you can call models directly in handlers:

```typescript
// Simplified router without service
export const simpleFeatureRouter = base.simpleFeature.router({
  getItem: protectedProcedure
    .use(simpleFeatureContract.getItem)
    .handler(async ({ input, context }) => {
      const item = await ItemModel.findById(input.itemId);
      
      if (!item) {
        throw ORPCNotFoundError(ERROR_CODES.ITEM_NOT_FOUND);
      }

      if (item.ownerId !== context.session.user.id) {
        throw ORPCForbiddenError(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      }

      return item;
    }),

  createItem: protectedProcedure
    .use(simpleFeatureContract.createItem)
    .handler(async ({ input, context }) => {
      const item = await ItemModel.create({
        ...input,
        ownerId: context.session.user.id,
        _id: ObjectIdString(),
      });

      return item;
    }),
});
```
