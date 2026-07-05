import { createFileRoute, Navigate, Outlet, redirect } from '@tanstack/react-router';

import { tryCatch } from '@startername/shared/helpers/std-utils';

import PseudoPage from '@~/components/pseudo-page';
import { useMe, meQueryOptions } from '@~/features/user';

export const Route = createFileRoute('/_auth_only')({
  beforeLoad: async ({ context }) => {
    const { data, error } = await tryCatch(async () => context.queryClient.ensureQueryData(meQueryOptions));
    if (error) throw redirect({ to: '/' }); // if redirected to auth, may cause infinite loop of redirects
    if (!data?.session) throw redirect({ to: '/auth' });
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { isLoggedIn, isPending } = useMe();

  if (isPending) return <PseudoPage />;
  if (!isLoggedIn) return <Navigate to="/auth" />;

  return <Outlet />;
}
