import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import z from 'zod';

// Uncomment to enable logging for proxy. Use for debugging purposes only.
// const configureProxy = (proxy: HttpProxy.Server) => {
//     proxy.on('error', (err, _req, _res) => {
//         console.log('proxy error', err);
//     });
//     proxy.on('proxyReq', (proxyReq, req, _res) => {
//         console.log('Sending Request to the Target:', req.method, req.url);
//     });
//     proxy.on('proxyRes', (proxyRes, req, _res) => {
//         console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
//     });
// };

export default defineConfig(({ mode }) => {
  const processEnv = loadEnv(mode, process.cwd());

  const VITE_CONFIG_SCHEMA = z.object({
    VITE_SERVER_URL: z.string(),
    VITE_HOST: z.string().default('localhost'),
    VITE_PORT: z.coerce.number().default(3030),
  });

  const env = VITE_CONFIG_SCHEMA.parse(processEnv);

  return {
    plugins: [
      devtools(),
      tailwindcss(),
      tanstackStart({
        router: {
          quoteStyle: 'single',
          semicolons: true,
        },
      }),
      react({
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
    ],
    resolve: {
      alias: {
        '@~': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: env.VITE_HOST,
      port: env.VITE_PORT,
      proxy: {
        '/api': {
          // keep this in-sync with SSR helpers as during SSR vite proxy is not recognized
          target: env.VITE_SERVER_URL,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
          // configure: configureProxy,
        },
      },
    },
  };
});
