import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { formatCop } from '../common/format.util';
import {
  ChannelType,
  DeliveryStatus,
} from '../notifications/notification.enums';
import {
  ChannelMessage,
  ChannelResult,
  NotificationChannel,
} from './channel.interface';
import { TemplateService } from './template.service';

@Injectable()
export class EmailChannel implements NotificationChannel {
  readonly type = ChannelType.EMAIL;
  private readonly logger = new Logger(EmailChannel.name);

  constructor(
    private readonly config: ConfigService,
    private readonly templates: TemplateService,
  ) {}

  async send(message: ChannelMessage): Promise<ChannelResult> {
    const apiKey = this.config.get<string>('channels.email.brevoApiKey');
    const from = this.config.get<string>('channels.email.from')!;

    if (!message.destination) {
      return {
        status: DeliveryStatus.SKIPPED,
        provider: 'brevo',
        error: 'no_destination',
      };
    }

    const html = message.sourceEvent
      ? this.templates.render(message.sourceEvent, this.buildTemplateVars(message))
      : null;

    if (!apiKey) {
      this.logger.log(
        `[SANDBOX EMAIL] a=${message.destination} asunto="${message.title}" template=${message.sourceEvent ?? 'none'}`,
      );
      return { status: DeliveryStatus.SENT, provider: 'sandbox' };
    }

    try {
      const sender = this.parseSender(from);
      const response = await axios.post<{ messageId: string }>(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender,
          to: [{ email: message.destination, name: message.recipientName ?? undefined }],
          subject: message.title,
          ...(html ? { htmlContent: html } : { textContent: message.body }),
        },
        {
          headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
          timeout: 10_000,
        },
      );
      return {
        status: DeliveryStatus.SENT,
        provider: 'brevo',
        providerMessageId: response.data?.messageId,
      };
    } catch (error) {
      return {
        status: DeliveryStatus.FAILED,
        provider: 'brevo',
        error: axios.isAxiosError(error)
          ? `${error.response?.status} ${JSON.stringify(error.response?.data ?? error.message)}`
          : (error as Error).message,
      };
    }
  }

  private parseSender(from: string): { name: string; email: string } {
    const match = from.match(/^(.+?)\s*<(.+?)>$/);
    if (match) return { name: match[1].trim(), email: match[2].trim() };
    return { name: 'ECIExpress', email: from.trim() };
  }

  private buildTemplateVars(message: ChannelMessage): Record<string, unknown> {
    const data = message.data ?? {};
    return {
      title: message.title,
      body: message.body,
      recipientName: message.recipientName ? ` ${message.recipientName}` : '',
      year: new Date().getFullYear(),
      frontendUrl: this.config.get<string>('app.frontendUrl') ?? '',
      ...data,
      ...(typeof data.amount === 'number'
        ? { amountFormatted: formatCop(data.amount) }
        : {}),
    };
  }
}
