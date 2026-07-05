import { createFileRoute, Link } from '@tanstack/react-router';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@~/components/ui/tabs';

export const Route = createFileRoute('/_auth_only/dashboard')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
              <p className="mt-1 text-muted-foreground">This is your dashboard!</p>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <Link to="/profile" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                View Profile
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Tabs defaultValue="tab1" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>

          <TabsContent value="tab1" className="mt-3 space-y-3">
            Tab 1 Content
          </TabsContent>
          <TabsContent value="tab2" className="mt-3 space-y-3">
            Tab 2 Content
          </TabsContent>
          <TabsContent value="tab3" className="mt-3 space-y-3">
            Tab 3 Content
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
