import type { mongoose } from '@typegoose/typegoose';
import { container } from 'tsyringe';

import { AuthService } from '@~/features/auth/auth.service';
import { EventBus } from '@~/features/events/event-bus';
import { ValkeyService } from '@~/features/valkey/valkey.service';

export default async function authLoader(db: mongoose.mongo.Db) {
  const authService = container.resolve(AuthService);
  const valkeyService = container.resolve(ValkeyService);
  const eventBus = container.resolve(EventBus);
  const valkey = await valkeyService.connect();

  authService.connect(db, valkey, eventBus);

  return authService.getInstance();
}
