import { createTanstackQueryUtils } from '@orpc/tanstack-query';

import client from './orpc';

export const tanstackRPC = createTanstackQueryUtils(client);
