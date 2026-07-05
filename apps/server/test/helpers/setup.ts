import mongoose from 'mongoose';
import { afterEach } from 'vitest';

// Import connection module to ensure mongoose is connected
// This module handles the connection and awaits it at module level
import './connection';
// Import custom matchers
import './matchers';

afterEach(async () => {
  // Guard: only clean up if connection is still open
  if (mongoose.connection.readyState !== 1) return;

  // Use deleteMany on all collections instead of dropDatabase - much faster
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

// Note: We don't disconnect mongoose in afterAll because with isolate: false,
// all test files share the connection. Disconnecting in one file's afterAll
// would break other test files still running. The connection is automatically
// cleaned up when the process exits (MongoDB Memory Server stops in globalSetup teardown).
