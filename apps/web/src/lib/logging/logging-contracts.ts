import { z } from 'zod';

export const LOG_LEVEL_SCHEMA = z.enum(['debug', 'info', 'warn', 'error', 'fatal']);
export const LOG_LEVELS = LOG_LEVEL_SCHEMA.enum;
export type LogLevel = z.infer<typeof LOG_LEVEL_SCHEMA>;

export const LOG_RUNTIME_SCHEMA = z.enum(['client', 'server']);
export const LOG_RUNTIMES = LOG_RUNTIME_SCHEMA.enum;
export type LogRuntime = z.infer<typeof LOG_RUNTIME_SCHEMA>;

export const serializedErrorSchema = z.object({
  name: z.string().max(120),
  message: z.string().max(2_000),
  stack: z.string().max(8_000).optional(),
  cause: z.string().max(2_000).optional(),
});

export const clientLogRecordSchema = z.object({
  level: z.enum([LOG_LEVELS.error, LOG_LEVELS.fatal]),
  component: z.string().min(1).max(120),
  message: z.string().min(1).max(2_000),
  context: z.record(z.string(), z.unknown()).optional(),
  error: serializedErrorSchema.optional(),
});

export type ClientLogRecord = z.infer<typeof clientLogRecordSchema>;
export type LogContext = Record<string, unknown>;

export interface iLogger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, error?: unknown, context?: LogContext) => void;
  fatal: (message: string, error?: unknown, context?: LogContext) => void;
  child: (context: LogContext) => iLogger;
}

export interface iLoggerFactory {
  getLogger: (component: string) => iLogger;
}
