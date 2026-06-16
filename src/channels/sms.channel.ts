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
 * Canal de SMS usando Twilio (API HTTP de Messages).
 *
 * Sin `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` el canal entra en
 * modo sandbox y solo loguea el mensaje.
 */
@Injectable()
export class SmsChannel implements NotificationChannel {
  readonly type = ChannelType.SMS;
  private readonly logger = new Logger(SmsChannel.name);

  constructor(private readonly config: ConfigService) {}

  async send(message: ChannelMessage): Promise<ChannelResult> {
    const accountSid = this.config.get<string>('channels.sms.accountSid');
    const authToken = this.config.get<string>('channels.sms.authToken');
    const from = this.config.get<string>('channels.sms.from');

    if (!message.destination) {
      return {
        status: DeliveryStatus.SKIPPED,
        provider: 'twilio',
        error: 'no_destination',
      };
    }

    // El SMS es de texto corto: se antepone el título solo si existe.
    const text = message.title
      ? `${message.title}: ${message.body}`
      : message.body;

    if (!accountSid || !authToken || !from) {
      this.logger.log(
        `[SANDBOX SMS] a=${message.destination} mensaje="${text}"`,
      );
      return { status: DeliveryStatus.SENT, provider: 'sandbox' };
    }

    try {
      const params = new URLSearchParams({
        To: message.destination,
        From: from,
        Body: text,
      });
      const response = await axios.post<{ sid: string }>(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        params.toString(),
        {
          auth: { username: accountSid, password: authToken },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10_000,
        },
      );
      return {
        status: DeliveryStatus.SENT,
        provider: 'twilio',
        providerMessageId: response.data?.sid,
      };
    } catch (error) {
      return {
        status: DeliveryStatus.FAILED,
        provider: 'twilio',
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
