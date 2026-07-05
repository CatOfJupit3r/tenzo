import { oc } from '@orpc/contract';

export const authProcedure = oc.meta({ auth: 'USER' as const } as const);
