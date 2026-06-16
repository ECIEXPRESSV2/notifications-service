import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  ChannelType,
  DeliveryStatus,
} from '../notifications/notification.enums';
import {
  ChannelMessage,
  ChannelResult,
  NotificationChannel,
} from './channel.interface';

/**
 * Canal de notificaciones push usando Firebase Cloud Messaging (FCM).
 *
 * Se usa la API legacy (`fcm.googleapis.com/fcm/send` con `Authorization: key=...`),
 * que admite enviar a varios tokens (`registration_ids`) en una sola llamada y es la
 * más simple de configurar.
 * TODO PRODUCCION: migrar a la API HTTP v1 de FCM (OAuth2 con cuenta de servicio),
 * ya que la API legacy está marcada como deprecada por Google.
 *
 * Sin `FCM_SERVER_KEY` el canal entra en modo sandbox y solo loguea el mensaje.
 */
@Injectable()
export class PushChannel implements NotificationChannel {
  readonly type = ChannelType.PUSH;
  private readonly logger = new Logger(PushChannel.name);

  constructor(private readonly config: ConfigService) {}

  async send(message: ChannelMessage): Promise<ChannelResult> {
    const serverKey = this.config.get<string>('channels.push.fcmServerKey');
    const tokens = (message.deviceTokens ?? []).filter(Boolean);

    if (tokens.length === 0) {
      return {
        status: DeliveryStatus.SKIPPED,
        provider: 'fcm',
        error: 'no_device_tokens',
      };
    }

    if (!serverKey) {
      this.logger.log(
        `[SANDBOX PUSH] tokens=${tokens.length} titulo="${message.title}" cuerpo="${message.body}"`,
      );
      return { status: DeliveryStatus.SENT, provider: 'sandbox' };
    }

    try {
      const response = await axios.post<{ multicast_id: number }>(
        'https://fcm.googleapis.com/fcm/send',
        {
          registration_ids: tokens,
          notification: { title: message.title, body: message.body },
          data: message.data ?? {},
        },
        {
          headers: { Authorization: `key=${serverKey}` },
          timeout: 10_000,
        },
      );
      return {
        status: DeliveryStatus.SENT,
        provider: 'fcm',
        providerMessageId: response.data?.multicast_id?.toString(),
      };
    } catch (error) {
      return {
        status: DeliveryStatus.FAILED,
        provider: 'fcm',
        error: this.describeError(error),
      };
    }
  }

  private describeError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      return `${error.response?.status ?? ''} ${JSON.stringify(error.response?.data ?? error.message)}`.trim();
    }
    return (error as Error).message;
  }
}
