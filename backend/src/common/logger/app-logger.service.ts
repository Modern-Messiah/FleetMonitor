import { Injectable, LoggerService } from '@nestjs/common';
import { createLogger, format, transports } from 'winston';

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.printf(({ timestamp, level, message, context, stack }) => {
        const contextSuffix = context ? ` [${context}]` : '';
        const stackSuffix = stack ? `\n${stack}` : '';
        return `${timestamp} ${level.toUpperCase()}${contextSuffix} ${message}${stackSuffix}`;
      }),
    ),
    transports: [new transports.Console()],
  });

  log(message: unknown, context?: string) {
    this.logger.info(this.serialize(message), { context });
  }

  error(message: unknown, trace?: string, context?: string) {
    this.logger.error(this.serialize(message), {
      context,
      stack: trace,
    });
  }

  warn(message: unknown, context?: string) {
    this.logger.warn(this.serialize(message), { context });
  }

  debug(message: unknown, context?: string) {
    this.logger.debug(this.serialize(message), { context });
  }

  verbose(message: unknown, context?: string) {
    this.logger.verbose(this.serialize(message), { context });
  }

  logHttp(method: string, url: string, statusCode: number, durationMs: number) {
    this.logger.info(`${method} ${url} ${statusCode} ${durationMs}ms`, {
      context: 'HTTP',
    });
  }

  private serialize(message: unknown) {
    if (typeof message === 'string') {
      return message;
    }
    return JSON.stringify(message);
  }
}
