import { config } from 'dotenv';
import { z } from 'zod';

switch (process.env.NODE_ENV) {
  case 'test':
    break;
  case 'production': {
    // we assume they are passed to by container
    // e.g. Heroku, Docker, etc.
    console.log('Current environment expects variables to by passed by container');
    break;
  }
  case 'development':
    console.log('Using .development.env file');
    config({ quiet: true });
    console.log('Loaded .development.env file');
    break;
  default:
    throw new Error(`Invalid NODE_ENV: ${process.env.NODE_ENV}.`);
}

const envSchema = z.object({
  // AUTH CONFIG
  BETTER_AUTH_SECRET: z.string(),
  BETTER_AUTH_URL: z.url(),

  // DB CONFIG
  MONGO_URI: z.url().optional().default('mongodb://localhost:6060/startername'),
  MONGO_USER: z.string().optional().default('username'),
  MONGO_PASSWORD: z.string().optional().default('password'),
  MONGO_DATABASE_NAME: z.string().optional().default('startername'),

  // VALKEY / REDIS CONFIG
  VALKEY_HOST: z.string().optional().default('localhost'),
  VALKEY_PORT: z.coerce.number().optional().default(6379),
  VALKEY_USERNAME: z.string().optional(),
  VALKEY_PASSWORD: z.string().optional(),
  VALKEY_DB: z.coerce.number().int().optional().default(0),

  // SERVER CONFIG
  SERVER_PORT: z.coerce.number().int().min(1).max(65535).optional().default(5050),
  SERVER_HOST: z.string().optional().default('localhost'),
  CORS_ORIGIN: z.url().optional().default(''),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const env = envSchema.safeParse(process.env);
if (!env.success) {
  console.error('Environment variables validation failure:', z.treeifyError(env.error));
  throw new Error('Invalid environment variables');
}

export default env.data;
