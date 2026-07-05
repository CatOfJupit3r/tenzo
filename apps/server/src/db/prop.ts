import { prop } from '@typegoose/typegoose';
import type { BasePropOptions } from '@typegoose/typegoose/lib/types';

import { ObjectIdString } from './helpers';

/**
 * ID property decorator for _id fields with auto-generated ObjectId string
 * @param options - Typegoose prop options (excluding default)
 */
export function idProp(options: Omit<BasePropOptions, 'default'> = {}) {
  return prop({ default: () => ObjectIdString(), ...options });
}
