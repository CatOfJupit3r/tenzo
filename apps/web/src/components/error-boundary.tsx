import { Link, useRouter } from '@tanstack/react-router';
import { HiOutlineExclamationCircle, HiOutlineHome, HiOutlineRefresh } from 'react-icons/hi';

import { IS_DEVELOPMENT } from '@~/constants';

import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface iErrorBoundaryProps {
  error: Error;
  reset?: () => void;
}

export function ErrorBoundary({ error, reset }: iErrorBoundaryProps) {
  const router = useRouter();

  const handleReset = () => {
    if (reset) {
      reset();
    } else {
      void router.invalidate();
    }
  };

  if (IS_DEVELOPMENT) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
                <HiOutlineExclamationCircle className="size-5 text-destructive" />
              </div>
              <div>
                <CardTitle>Development Error</CardTitle>
                <CardDescription>An error occurred while rendering this page</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <HiOutlineExclamationCircle className="size-4" />
              <AlertTitle>{error.name || 'Error'}</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>

            {error.stack ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Stack Trace:</h3>
                <pre className="max-h-64 overflow-x-auto rounded-lg bg-muted p-4 text-xs">
                  <code>{error.stack}</code>
                </pre>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleReset} variant="default">
                <HiOutlineRefresh className="mr-2 size-4" />
                Try Again
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">
                  <HiOutlineHome className="mr-2 size-4" />
                  Go Home
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
              <HiOutlineExclamationCircle className="size-5 text-destructive" />
            </div>
            <div>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>We&apos;re sorry, but something unexpected happened</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The page encountered an error and couldn&apos;t be displayed. You can try refreshing the page or return to
            the home page.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleReset} variant="default">
              <HiOutlineRefresh className="mr-2 size-4" />
              Try Again
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">
                <HiOutlineHome className="mr-2 size-4" />
                Go Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
