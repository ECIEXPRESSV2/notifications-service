import { Injectable } from '@nestjs/common';
import { loggingStorage } from './logging.context';

export type NotificationLogEvent =
  | 'event.received'
  | 'event.ignored'
  | 'event.duplicate'
  | 'notification.created'
  | 'notification.dispatched'
  | 'delivery.sent'
  | 'delivery.failed'
  | 'delivery.skipped'
  | 'recipient.upserted'
  | 'device.registered';

export interface NotificationLogData {
  [key: string]: unknown;
}

/**
 * Logger inyectable para eventos de notificación estructurados.
 * Incluye automáticamente el userId del contexto HTTP (vía AsyncLocalStorage).
 *
 * Salida JSON compatible con Application Insights. Para activar AI en el futuro:
 *   import * as ai from 'applicationinsights';
 *   ai.defaultClient.trackEvent({ name: event, properties: { ...entry } });
 */
@Injectable()
export class NotificationLogger {
  private userId(): string | undefined {
    return loggingStorage.getStore()?.userId;
  }

  private emit(
    level: 'info' | 'warn' | 'error',
    event: NotificationLogEvent,
    message: string,
    data?: NotificationLogData,
  ): void {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      service: 'notifications-service',
      event,
      userId: this.userId(),
      message,
      ...data,
    };
    const out = level === 'error' ? process.stderr : process.stdout;
    out.write(JSON.stringify(entry) + '\n');
  }

  logEvent(
    event: NotificationLogEvent,
    message: string,
    data?: NotificationLogData,
  ): void {
    this.emit('info', event, message, data);
  }

  warnEvent(
    event: NotificationLogEvent,
    message: string,
    data?: NotificationLogData,
  ): void {
    this.emit('warn', event, message, data);
  }

  errorEvent(
    event: NotificationLogEvent,
    message: string,
    data?: NotificationLogData,
  ): void {
    this.emit('error', event, message, data);
  }
}
