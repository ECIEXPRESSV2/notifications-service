import { LoggerService, LogLevel } from '@nestjs/common';
import { loggingStorage } from './logging.context';

/**
 * Reemplaza el logger por defecto de NestJS.
 * Emite JSON estructurado a stdout/stderr para que Application Insights
 * (o cualquier colector de logs) pueda parsear y correlacionar por userId.
 *
 * Para conectar Application Insights en el futuro, reemplazar process.stdout.write
 * por appInsights.defaultClient.trackTrace({ message, severityLevel, properties }).
 */
export class StructuredLogger implements LoggerService {
  private write(
    level: string,
    message: unknown,
    context?: string,
    trace?: string,
  ): void {
    const store = loggingStorage.getStore();
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      service: 'notifications-service',
      ...(context && { context }),
      ...(store?.userId && { userId: store.userId }),
      message: this.serialize(message),
      ...(trace && { trace }),
    };
    const out = level === 'error' ? process.stderr : process.stdout;
    out.write(JSON.stringify(entry) + '\n');
  }

  /**
   * Las propiedades de Error (message, stack, name) no son enumerables,
   * por lo que JSON.stringify las omite y produce {}. Las extraemos explícitamente.
   */
  private serialize(value: unknown): unknown {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        ...(value.stack && { stack: value.stack }),
      };
    }
    if (typeof value === 'object' && value !== null) return value;
    return String(value);
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    const context =
      typeof optionalParams[0] === 'string' ? optionalParams[0] : undefined;
    this.write('info', message, context);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    // NestJS llama error(message, stack?, context?)
    const trace =
      typeof optionalParams[0] === 'string' ? optionalParams[0] : undefined;
    const context =
      typeof optionalParams[1] === 'string' ? optionalParams[1] : undefined;
    this.write('error', message, context, trace);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    const context =
      typeof optionalParams[0] === 'string' ? optionalParams[0] : undefined;
    this.write('warn', message, context);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    const context =
      typeof optionalParams[0] === 'string' ? optionalParams[0] : undefined;
    this.write('debug', message, context);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    const context =
      typeof optionalParams[0] === 'string' ? optionalParams[0] : undefined;
    this.write('verbose', message, context);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    const context =
      typeof optionalParams[0] === 'string' ? optionalParams[0] : undefined;
    this.write('fatal', message, context);
  }

  setLogLevels(_levels: LogLevel[]): void {}
}
