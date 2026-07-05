import { createFileRoute } from '@tanstack/react-router';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@~/components/ui/card';

export const Route = createFileRoute('/')({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="space-y-4">
          <p className="text-sm font-medium tracking-[0.3em] text-muted-foreground uppercase">Phase 0 Complete</p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Character Card Creator</h1>
          <p className="max-w-3xl text-lg text-muted-foreground">
            The starter-template backend, auth, profile, badge, and achievement surfaces have been removed so the repo
            can converge on the standalone character card creator described in the roadmap.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Next implementation slice</CardTitle>
            <CardDescription>
              Phase 1 will replace this placeholder with the actual editor at the root route.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Manual V2 card editing will live here, backed by local browser persistence.</p>
            <p>PNG and JSON import/export, example characters, and AI generation follow in later phases.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
