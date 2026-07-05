import { useMutation, useQueryClient } from '@tanstack/react-query';

import { toastBetterAuthError } from '@~/components/toastifications';
import { USE_ME_QUERY_KEYS } from '@~/features/user/hooks/use-me';
import AuthService from '@~/services/auth.service';

const useLogin = () => {
  const queryClient = useQueryClient();

  const {
    mutateAsync: mutate,
    isPending,
    isSuccess,
  } = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) =>
      AuthService.getInstance().signIn.username({
        username,
        password,
        rememberMe: true,
        fetchOptions: { throw: true },
      }),
    onError: (err) => {
      toastBetterAuthError('Login Failed', err);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: USE_ME_QUERY_KEYS(),
      });
    },
  });

  return {
    mutate,
    isPending,
    isSuccess,
  };
};

export default useLogin;
