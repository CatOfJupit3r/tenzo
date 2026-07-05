import { singleton } from 'tsyringe';

import { buildCacheKey, CACHE_TTL } from '@~/features/valkey/valkey.constants';
import { ValkeyService } from '@~/features/valkey/valkey.service';

import { LoggerFactory } from '../logger/logger.factory';
import type { iWithLogger } from '../logger/logger.types';
import { BADGES_META } from './badges.constants';

@singleton()
export class BadgesService implements iWithLogger {
  public readonly logger: iWithLogger['logger'];

  constructor(
    private readonly valkey: ValkeyService,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create('badges');
  }

  public async listAllBadges() {
    return this.valkey.cached(buildCacheKey.badges(), CACHE_TTL.STATIC, async () => {
      this.logger.debug('Cache miss for badges list, returning static data');
      return BADGES_META;
    });
  }
}
