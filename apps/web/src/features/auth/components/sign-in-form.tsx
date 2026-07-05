import z from 'zod';

import { Button } from '@~/components/ui/button';
import { useAppForm } from '@~/components/ui/field';
import { QuickSignIn } from '@~/features/dev-tools';

import useLogin from '../hooks/use-login';

export default function SignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => unknown }) {
  const { mutate } = useLogin();

  const form = useAppForm({
    defaultValues: {
      username: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      await mutate({
        username: value.username,
        password: value.password,
      });
    },
    validators: {
      onSubmit: z.object({
        username: z.string().min(2, 'Username must be at least 2 characters'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
      }),
    },
  });

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-6 text-center text-3xl font-bold">Welcome Back</h1>

      <form.AppForm>
        <form.Form className="space-y-4 p-0 md:p-0">
          <form.AppField name="username">{(field) => <field.TextField label="Username" />}</form.AppField>
          <form.AppField name="password">
            {(field) => <field.TextField label="Password" type="password" />}
          </form.AppField>
          <form.SubmitButton>Sign In</form.SubmitButton>
        </form.Form>
      </form.AppForm>

      <QuickSignIn />

      <div className="text-center">
        <Button variant="link" onClick={onSwitchToSignUp} className="text-lime-300 hover:text-lime-400">
          Need an account? Sign Up
        </Button>
      </div>
    </div>
  );
}
