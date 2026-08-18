import { z } from 'zod';

export type iJsonValue = null | boolean | number | string | iJsonValue[] | { [key: string]: iJsonValue };

export const JSON_VALUE_SCHEMA: z.ZodType<iJsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(JSON_VALUE_SCHEMA),
    z.record(z.string(), JSON_VALUE_SCHEMA),
  ]),
);
