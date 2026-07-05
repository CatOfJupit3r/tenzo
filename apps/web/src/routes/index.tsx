import { Link, createFileRoute } from '@tanstack/react-router';
import { FaUserCircle } from 'react-icons/fa';
import { HiOutlineSparkles } from 'react-icons/hi';
import { LuRocket, LuServerCog } from 'react-icons/lu';
import { TbLayoutDashboard } from 'react-icons/tb';

import { Badge } from '@~/components/ui/badge';
import { Button } from '@~/components/ui/button';
import { Card, CardContent } from '@~/components/ui/card';
import { Skeleton } from '@~/components/ui/skeleton';
import { useHealthCheck } from '@~/hooks/queries/use-health-check';
import { useMetrics } from '@~/hooks/queries/use-metrics';

export const Route = createFileRoute('/')({
  component: HomeComponent,
});

const CountSkeleton = () => <Skeleton className="h-7 w-[5ch]" />;

function Metrics() {
  const { data: metrics, isPending, error } = useMetrics();

  return (
    <div className="mt-10 border-t border-border pt-10">
      <p className="mb-4 text-sm text-muted-foreground">Join thousands of challenge creators and competitors</p>
      <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
        <div className="flex flex-col items-center">
          <div className="text-lg font-bold text-foreground">
            {isPending || error ? <CountSkeleton /> : metrics?.totalUsers}
          </div>
          <p className="text-xs">Total Users</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex flex-col items-center">
          <div className="text-lg font-bold text-foreground">
            {isPending || error ? <CountSkeleton /> : metrics?.activeSessions}
          </div>
          <p className="text-xs">Active Sessions</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge() {
  const { data, isPending, error } = useHealthCheck();

  if (isPending)
    return (
      <Badge className="mb-6 bg-yellow-100 text-yellow-700 hover:bg-yellow-100">⏳ Checking Service Status...</Badge>
    );

  if (error || data?.status !== 'OK')
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">⚠️ Service Unhealthy</Badge>;

  return (
    <Badge className="mb-6 bg-purple-100 text-purple-700 hover:bg-purple-100">🎯 The Challenge Platform is Live</Badge>
  );
}

const FEATURES = [
  {
    title: 'Contract-first approach',
    description: 'Start building with clear API contracts using oRPC',
    icon: <LuServerCog className="h-8 w-8" />,
  },
  {
    title: 'Shiny new tech',
    description: 'Built with Node.js, React, TanStack Router, and more modern technologies.',
    icon: <HiOutlineSparkles className="h-8 w-8" />,
  },
  {
    title: 'Ready-to-use template',
    description: 'Jumpstart your project with a full-stack starter template.',
    icon: <LuRocket className="h-8 w-8" />,
  },
];

function HomeComponent() {
  return (
    <div className="min-h-[calc(100vh-4rem)] overflow-y-auto bg-background">
      {/* Hero Section */}
      <section className="relative border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <StatusBadge />

            {/* Main Headline */}
            <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              Turn Ideas Into
              <br className="my-3" />
              <span className="bg-linear-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                SaaS Products
              </span>
            </h1>

            {/* Subheading */}
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Don&apos;t bother managing your own setup. Launch your next project with our full-stack starter template
              built with Node.js, React, TanStack Router, and oRPC.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex justify-center gap-4">
              <Link to="/dashboard">
                <Button size="lg" variant="outline">
                  <TbLayoutDashboard className="h-5 w-5" />
                  See Dashboard
                </Button>
              </Link>
              <Link to="/profile">
                <Button size="lg" className="gap-2">
                  <FaUserCircle className="h-5 w-5" />
                  See Profile
                </Button>
              </Link>
            </div>

            <Metrics />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-b border-border py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Everything You Need!</h2>
            <p className="mt-4 text-lg text-muted-foreground">Built for developers.</p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="pt-6">
                  <div className="mb-4 text-purple-600">{feature.icon}</div>
                  <h3 className="mb-2 font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
