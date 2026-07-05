import type mongoose from 'mongoose';
import { container } from 'tsyringe';

import { DatabaseService } from '@~/db/database.service';

export default async function databaseLoader(): Promise<mongoose.mongo.Db> {
  const databaseService = container.resolve(DatabaseService);
  await databaseService.connect();

  return databaseService.getClient();
}
