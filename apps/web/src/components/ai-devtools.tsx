import { aiDevtoolsPlugin } from '@tanstack/react-ai-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';

const AI_DEVTOOLS_PLUGINS = [aiDevtoolsPlugin()];

export function AiDevtools() {
  return null;
  // for now disable
  if (!import.meta.env.DEV) return null;
  return <TanStackDevtools plugins={AI_DEVTOOLS_PLUGINS} eventBusConfig={{ connectToServerBus: true }} />;
}
