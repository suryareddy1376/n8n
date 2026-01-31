import winston from 'winston';
import { config } from '../config/index.js';

// Custom log format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// JSON format for production
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: config.server.isProduction ? jsonFormat : customFormat,
  defaultMeta: { service: 'dcms-backend' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: config.server.isProduction
        ? jsonFormat
        : winston.format.combine(winston.format.colorize(), customFormat),
    }),
  ],
});

// Add file transports in production
if (config.server.isProduction) {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );
  
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );
}

// Create child logger with additional context
export const createLogger = (context: string) => {
  return logger.child({ context });
};

// Request logging helper
export const logRequest = (
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  userId?: string
) => {
  const logData = {
    method,
    path,
    statusCode,
    duration: `${duration}ms`,
    userId: userId || 'anonymous',
  };

  if (statusCode >= 500) {
    logger.error('Request completed with error', logData);
  } else if (statusCode >= 400) {
    logger.warn('Request completed with client error', logData);
  } else {
    logger.info('Request completed', logData);
  }
};

export default logger;
