import { createServerFn } from '@tanstack/react-start';
import { Logger } from 'tslog';

import { isOnClient } from '../../utils/ssr-helpers';
import { sanitizeLogContext, serializeError } from './log-sanitizer';
import type { ClientLogRecord, iLogger, iLoggerFactory, LogContext, LogLevel, LogRuntime } from './logging-contracts';
import { clientLogRecordSchema, LOG_LEVEL_ENUM, LOG_LEVELS, LOG_RUNTIMES } from './logging-contracts';

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
  serverLogger ??= createTsLogger(LOG_RUNTIMES.SERVER);
  return serverLogger;
}

export const reportClientLog = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => clientLogRecordSchema.parse(data))
  .handler(({ data }) => {
    const record = clientLogRecordSchema.parse(data);
    const fields = {
      component: record.component,
      runtime: LOG_RUNTIMES.CLIENT,
      ...sanitizeLogContext(record.context),
      ...(record.error ? { error: record.error } : {}),
    };
    const logger = getServerTsLogger();
    if (record.level === LOG_LEVELS.FATAL) logger.fatal(fields, record.message);
    else logger.error(fields, record.message);
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
  const levelWriters = LOG_LEVEL_ENUM.derive(
    [LOG_LEVELS.DEBUG, tsLogger.debug.bind(tsLogger)],
    [LOG_LEVELS.INFO, tsLogger.info.bind(tsLogger)],
    [LOG_LEVELS.WARN, tsLogger.warn.bind(tsLogger)],
    [LOG_LEVELS.ERROR, tsLogger.error.bind(tsLogger)],
    [LOG_LEVELS.FATAL, tsLogger.fatal.bind(tsLogger)],
  );
  const write = (level: LogLevel, message: string, error?: unknown, context?: LogContext) => {
    const safeContext = sanitizeLogContext({ ...bindings, ...context });
    const serializedError = error === undefined ? undefined : serializeError(error);
    const fields = { component, runtime, ...safeContext, ...(serializedError ? { error: serializedError } : {}) };
    levelWriters.get(level)(fields, message);
    if (runtime === LOG_RUNTIMES.CLIENT && (level === LOG_LEVELS.ERROR || level === LOG_LEVELS.FATAL)) {
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
    debug: (message, context) => write(LOG_LEVELS.DEBUG, message, undefined, context),
    info: (message, context) => write(LOG_LEVELS.INFO, message, undefined, context),
    warn: (message, context) => write(LOG_LEVELS.WARN, message, undefined, context),
    error: (message, error, context) => write(LOG_LEVELS.ERROR, message, error, context),
    fatal: (message, error, context) => write(LOG_LEVELS.FATAL, message, error, context),
    child: (context) => createApplicationLogger(tsLogger, runtime, component, { ...bindings, ...context }),
  };
}

function createApplicationLoggerFactory(runtime: LogRuntime): iLoggerFactory {
  const tsLogger = runtime === LOG_RUNTIMES.SERVER ? getServerTsLogger() : createTsLogger(LOG_RUNTIMES.CLIENT);
  return {
    getLogger: (component) => createApplicationLogger(tsLogger, runtime, component),
  };
}

const APPLICATION_RUNTIME = isOnClient ? LOG_RUNTIMES.CLIENT : LOG_RUNTIMES.SERVER;

export const loggerFactory = createApplicationLoggerFactory(APPLICATION_RUNTIME);
