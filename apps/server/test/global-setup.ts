import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    MONGO_URI: string;
  }
}

export default async function setup({ provide }: TestProject) {
  const mongod = await MongoMemoryServer.create();

  const uri = mongod.getUri();

  // Expose to workers/tests via Vitest context
  provide('MONGO_URI', uri);

  // Also set process env so setup files and application code can consume it
  process.env.MONGO_URI = uri;
  process.env.MONGO_DATABASE_NAME = process.env.MONGO_DATABASE_NAME ?? 'startername-test';

  return async () => {
    await mongod.stop();
  };
}
