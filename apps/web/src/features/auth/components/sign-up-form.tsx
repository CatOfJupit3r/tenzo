import z from 'zod';

import { Button } from '@~/components/ui/button';
import { useAppForm } from '@~/components/ui/field';

import useRegister from '../hooks/use-register';

export default function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => unknown }) {
  const { mutate } = useRegister();

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: '',
      passwordConfirm: '',
      username: '',
      name: '',
    },
    onSubmit: async ({ value }) => {
      await mutate({
        email: value.email,
        password: value.password,
        name: value.name,
        username: value.username,
      });
    },
    validators: {
      onSubmit: z
        .object({
          username: z.string().min(2, 'Username must be at least 2 characters'),
          name: z.string().min(2, 'Name must be at least 2 characters'),
          email: z.string().email('Invalid email address'),
          password: z.string().min(8, 'Password must be at least 8 characters'),
          passwordConfirm: z.string().min(8, 'Password must be at least 8 characters'),
        })
        .refine((data) => data.password === data.passwordConfirm, {
          message: "Passwords don't match",
          path: ['passwordConfirm'],
        }),
    },
  });

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-6 text-center text-3xl font-bold">Create Account</h1>

      <form.AppForm>
        <form.Form className="space-y-4 p-0 md:p-0">
          <form.AppField name="username">{(field) => <field.TextField label="Username" />}</form.AppField>
          <form.AppField name="name">{(field) => <field.TextField label="Name" />}</form.AppField>
          <form.AppField name="email">{(field) => <field.TextField label="Email" type="email" />}</form.AppField>
          <form.AppField name="password">
            {(field) => <field.TextField label="Password" type="password" />}
          </form.AppField>
          <form.AppField name="passwordConfirm">
            {(field) => <field.TextField label="Confirm password" type="password" />}
          </form.AppField>
          <form.SubmitButton>Sign Up</form.SubmitButton>
        </form.Form>
      </form.AppForm>

      <div className="mt-4 text-center">
        <Button variant="link" onClick={onSwitchToSignIn} className="text-lime-300 hover:text-lime-400">
          Already have an account? Sign In
        </Button>
      </div>
    </div>
  );
}
