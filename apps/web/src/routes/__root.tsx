/// <reference types="vite/client" />
import { TanStackDevtools } from '@tanstack/react-devtools';
import { formDevtoolsPlugin } from '@tanstack/react-form-devtools';
import type { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { NuqsAdapter } from 'nuqs/adapters/react';
import type { ComponentProps } from 'react';

import Header from '@~/components/header';
import { getInitialThemeClass, getStoredTheme } from '@~/components/themes/helpers';
import { ThemeProvider } from '@~/components/themes/theme-provider';
import ToasterContainer from '@~/components/toastifications/toaster-container';
import { meQueryOptions } from '@~/features/user';
import { seo } from '@~/utils/seo';
import type { tanstackRPC } from '@~/utils/tanstack-orpc';

import appCss from '../index.css?url';

export interface iRouterAppContext {
  tanstackRPC: typeof tanstackRPC;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<iRouterAppContext>()({
  loader: async ({ context }) => {
    // keep this sucker here to make sure there are no hydration errors
    const [, initialTheme] = await Promise.all([context.queryClient.ensureQueryData(meQueryOptions), getStoredTheme()]);
    return { initialTheme };
  },
  component: RootComponent,
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      ...seo({
        title: 'startername',
        description: 'startername is a web application',
        image: '/social-preview.png',
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/png', href: '/favicon/favicon-96x96.png', sizes: '96x96' },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon/favicon.svg' },
      { rel: 'shortcut icon', href: '/favicon/favicon.ico' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon/apple-touch-icon.png' },
      { rel: 'manifest', href: '/favicon/site.webmanifest' },
    ],
  }),
});

const PLUGINS: ComponentProps<typeof TanStackDevtools>['plugins'] = [
  {
    name: 'TanStack Query',
    render: <ReactQueryDevtoolsPanel />,
    defaultOpen: true,
  },
  {
    name: 'TanStack Router',
    render: <TanStackRouterDevtoolsPanel />,
    defaultOpen: false,
  },
  formDevtoolsPlugin(),
];

function RootComponent() {
  const { initialTheme } = Route.useLoaderData();
  const themeClass = getInitialThemeClass(initialTheme);

  return (
    <html lang="en" className={themeClass} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider initialTheme={initialTheme}>
          <NuqsAdapter>
            <div className="grid h-svh grid-rows-[auto_1fr]">
              <Header />
              <Outlet />
            </div>
            <ToasterContainer />
          </NuqsAdapter>
        </ThemeProvider>
        <TanStackDevtools plugins={PLUGINS} />
        <Scripts />
      </body>
    </html>
  );
}
