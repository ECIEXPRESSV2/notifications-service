import { Injectable } from '@nestjs/common';
import {
  ChannelType,
  DeliveryStatus,
} from '../notifications/notification.enums';
import {
  ChannelMessage,
  ChannelResult,
  NotificationChannel,
} from './channel.interface';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Canal de notificación en tiempo real dentro de la aplicación. Emite la notificación
 * por WebSocket (Socket.IO) a las conexiones activas del usuario.
 *
 * La notificación ya quedó persistida en la tabla `notifications` (bandeja in-app), así
 * que aunque el usuario esté offline podrá verla al consultar `GET /notifications`.
 * Este canal solo se encarga de la entrega instantánea: si el usuario no está conectado
 * se marca SKIPPED (`recipient_offline`), no FAILED.
 */
@Injectable()
export class RealtimeChannel implements NotificationChannel {
  readonly type = ChannelType.REALTIME;

  constructor(private readonly gateway: RealtimeGateway) {}

  send(message: ChannelMessage): Promise<ChannelResult> {
    if (!message.userId) {
      return Promise.resolve({
        status: DeliveryStatus.SKIPPED,
        provider: 'socket',
        error: 'no_user_id',
      });
    }

    if (!this.gateway.isUserOnline(message.userId)) {
      return Promise.resolve({
        status: DeliveryStatus.SKIPPED,
        provider: 'socket',
        error: 'recipient_offline',
      });
    }

    this.gateway.emitToUser(message.userId, {
      type: message.type ?? null,
      title: message.title,
      body: message.body,
      data: message.data ?? null,
    });
    return Promise.resolve({ status: DeliveryStatus.SENT, provider: 'socket' });
  }
}
