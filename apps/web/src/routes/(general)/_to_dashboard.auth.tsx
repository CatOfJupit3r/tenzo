import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { SignInForm, SignUpForm } from '@~/features/auth';

export const Route = createFileRoute('/(general)/_to_dashboard/auth')({
  component: RouteComponent,
});

function RouteComponent() {
  const [shouldShowSignIn, setShouldShowSignIn] = useState(true);

  return shouldShowSignIn ? (
    <SignInForm onSwitchToSignUp={() => setShouldShowSignIn(false)} />
  ) : (
    <SignUpForm onSwitchToSignIn={() => setShouldShowSignIn(true)} />
  );
}
