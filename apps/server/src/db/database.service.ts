import mongoose from 'mongoose';
import { singleton } from 'tsyringe';

import env from '@~/constants/env';

@singleton()
export class DatabaseService {
  public async connect() {
    if (env.NODE_ENV !== 'test') {
      await this.connectToExternalDatabase();
    }
  }

  private async connectToExternalDatabase() {
    await mongoose.connect(env.MONGO_URI, {
      dbName: env.MONGO_DATABASE_NAME,
      auth: {
        username: env.MONGO_USER,
        password: env.MONGO_PASSWORD,
      },
    });
  }

  public getClient() {
    const client = mongoose.connection.getClient();
    if (!client) throw new Error('Database client is not connected');
    return client.db();
  }
}
