import mongoose from 'mongoose';
import 'reflect-metadata';

const uri = process.env.MONGO_URI;
const workerId = process.env.VITEST_WORKER_ID ?? '0';
const baseDbName = process.env.MONGO_DATABASE_NAME ?? 'startername-test';
const dbName = `${baseDbName}-${workerId}`;

// Ensure downstream code (e.g., DatabaseService) sees the scoped db name
process.env.MONGO_DATABASE_NAME = dbName;

if (!uri) {
  throw new Error('MONGO_URI was not provided to test setup');
}

const mongoUriWithDb = uri.endsWith('/') ? `${uri}${dbName}` : `${uri}/${dbName}`;

// Export a promise that resolves when mongoose is connected
export const mongooseConnection = mongoose.connect(mongoUriWithDb, {
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 5,
});

// Await at module level to ensure connection is established before exports are used
await mongooseConnection;
