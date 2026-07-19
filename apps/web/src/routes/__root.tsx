/// <reference types="vite/client" />
import type { QueryClient } from '@tanstack/react-query';
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router';
import { NuqsAdapter } from 'nuqs/adapters/react';

import { getInitialThemeClass, getStoredTheme } from '@~/components/themes/helpers';
import { ThemeProvider } from '@~/components/themes/theme-provider';
import ToasterContainer from '@~/components/toastifications/toaster-container';
import { seo } from '@~/utils/seo';

import appCss from '../index.css?url';

export interface iRouterAppContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<iRouterAppContext>()({
  loader: async () => {
    // keep this sucker here to make sure there are no hydration errors
    const initialTheme = await getStoredTheme();
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
        title: 'Character Card Creator',
        description: 'Standalone character card creation with import, export, and AI-assisted workflows.',
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
            <div className="grid h-svh min-h-0 grid-rows-[minmax(0,1fr)] overflow-hidden">
              <Outlet />
            </div>
            <ToasterContainer />
          </NuqsAdapter>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
