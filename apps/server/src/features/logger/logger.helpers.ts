import stringify from 'safe-stable-stringify';
import winston from 'winston';

/**
 * Winston logger format configuration
 * Format: [timestamp] [level] namespace: message {userId, requestId, ...meta}
 * Example: [2024-01-15 10:30:45.123 +00] [INFO    ] canvas: Canvas layout saved successfully {"userId":"abc123"}
 */
export function WINSTON_LOGGER_FORMAT(colorize: boolean) {
  return winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS ZZ',
    }),
    ...(colorize ? [winston.format.colorize({ level: true })] : []),
    winston.format.printf((info) => {
      const { timestamp, level, message, namespace = 'global', userId, requestId, ...meta } = info;
      const levelName = level.padEnd(8);

      let logMessage = `[${timestamp}] [${levelName}] ${namespace}: ${message}`;

      // Build context object with userId and requestId if present
      const contextMeta: Record<string, unknown> = {};
      if (userId) contextMeta.userId = userId;
      if (requestId) contextMeta.requestId = requestId;

      // Merge with remaining metadata
      const allMeta = { ...contextMeta, ...meta };
      const metaKeys = Object.keys(allMeta);
      if (metaKeys.length > 0) {
        logMessage += ` ${stringify(allMeta)}`;
      }

      return logMessage;
    }),
  );
}
