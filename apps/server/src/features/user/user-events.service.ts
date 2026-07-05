import { singleton } from 'tsyringe';

import { UserProfileModel } from '@~/db/models/user-profile.model';
import { EventBus } from '@~/features/events/event-bus';
import { UserAfterRegisteredListener } from '@~/features/events/listeners/user.listeners';

import { LoggerFactory } from '../logger/logger.factory';
import type { iWithLogger } from '../logger/logger.types';

@singleton()
export class UserEventsService implements iWithLogger {
  public readonly logger: iWithLogger['logger'];

  constructor(
    private readonly eventBus: EventBus,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create('user-events');
    this.initialize();
  }

  public initialize() {
    this.eventBus.on(UserAfterRegisteredListener, async ({ userId }) => {
      try {
        await UserProfileModel.create({ userId });
        this.logger.info('User profile created successfully', { userId });
      } catch (error) {
        this.logger.error('User profile creation failed', { userId, error });
      }
    });
  }
}
