import { createIsomorphicFn, createServerFn } from '@tanstack/react-start';
import { Logger } from 'tslog';

import { sanitizeLogContext, serializeError } from './log-sanitizer';
import { clientLogRecordSchema, LOG_LEVELS, LOG_RUNTIMES } from './logging-contracts';
import type { ClientLogRecord, iLogger, iLoggerFactory, LogContext, LogLevel, LogRuntime } from './logging-contracts';

interface iApplicationLog extends LogContext {
  component?: string;
  runtime: LogRuntime;
  error?: ReturnType<typeof serializeError>;
}

function createTsLogger(runtime: LogRuntime) {
  return new Logger<iApplicationLog>({
    name: 'tenzo',
    type: 'pretty',
  }).child({}, { runtime });
}

let serverLogger: Logger<iApplicationLog> | undefined;

function getServerTsLogger() {
  serverLogger ??= createTsLogger(LOG_RUNTIMES.server);
  return serverLogger;
}

export const reportClientLog = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => clientLogRecordSchema.parse(data))
  .handler(({ data }) => {
    const record = clientLogRecordSchema.parse(data);
    const fields = {
      component: record.component,
      runtime: LOG_RUNTIMES.client,
      ...sanitizeLogContext(record.context),
      ...(record.error ? { error: record.error } : {}),
    };
    getServerTsLogger()[record.level](fields, record.message);
  });

function forwardClientRecord(record: ClientLogRecord) {
  void reportClientLog({ data: record }).catch(() => {
    if (import.meta.env.DEV) console.warn('[logging] Unable to forward client error');
  });
}

function createApplicationLogger(
  tsLogger: Logger<iApplicationLog>,
  runtime: LogRuntime,
  component: string,
  bindings: LogContext = {},
): iLogger {
  const write = (level: LogLevel, message: string, error?: unknown, context?: LogContext) => {
    const safeContext = sanitizeLogContext({ ...bindings, ...context });
    const serializedError = error === undefined ? undefined : serializeError(error);
    const fields = { component, runtime, ...safeContext, ...(serializedError ? { error: serializedError } : {}) };
    tsLogger[level](fields, message);
    if (runtime === LOG_RUNTIMES.client && (level === LOG_LEVELS.error || level === LOG_LEVELS.fatal)) {
      forwardClientRecord({
        level,
        component,
        message,
        context: safeContext,
        ...(serializedError ? { error: serializedError } : {}),
      });
    }
  };

  return {
    debug: (message, context) => write(LOG_LEVELS.debug, message, undefined, context),
    info: (message, context) => write(LOG_LEVELS.info, message, undefined, context),
    warn: (message, context) => write(LOG_LEVELS.warn, message, undefined, context),
    error: (message, error, context) => write(LOG_LEVELS.error, message, error, context),
    fatal: (message, error, context) => write(LOG_LEVELS.fatal, message, error, context),
    child: (context) => createApplicationLogger(tsLogger, runtime, component, { ...bindings, ...context }),
  };
}

const createLoggerFactory = createIsomorphicFn()
  .server(
    (): iLoggerFactory => ({
      getLogger: (component) => createApplicationLogger(getServerTsLogger(), LOG_RUNTIMES.server, component),
    }),
  )
  .client((): iLoggerFactory => {
    const CLIENT_LOGGER = createTsLogger(LOG_RUNTIMES.client);
    return { getLogger: (component) => createApplicationLogger(CLIENT_LOGGER, LOG_RUNTIMES.client, component) };
  });

export const loggerFactory = createLoggerFactory();
