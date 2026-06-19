import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
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
  private readonly transporter: Transporter | null;

  constructor(
    private readonly config: ConfigService,
    private readonly templates: TemplateService,
  ) {
    const user = config.get<string>('channels.email.gmailUser');
    const pass = config.get<string>('channels.email.gmailAppPassword');

    this.transporter =
      user && pass
        ? nodemailer.createTransport(
            new SMTPTransport({
              host: 'smtp.gmail.com',
              port: 587,
              secure: false,
              auth: { user, pass },
              family: 4,
            }),
          )
        : null;
  }

  async send(message: ChannelMessage): Promise<ChannelResult> {
    const from = this.config.get<string>('channels.email.from')!;

    if (!message.destination) {
      return {
        status: DeliveryStatus.SKIPPED,
        provider: 'gmail',
        error: 'no_destination',
      };
    }

    const html = message.sourceEvent
      ? this.templates.render(message.sourceEvent, this.buildTemplateVars(message))
      : null;

    if (!this.transporter) {
      this.logger.log(
        `[SANDBOX EMAIL] a=${message.destination} asunto="${message.title}" template=${message.sourceEvent ?? 'none'}`,
      );
      return { status: DeliveryStatus.SENT, provider: 'sandbox' };
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to: message.destination,
        subject: message.title,
        ...(html ? { html } : { text: message.body }),
      });
      return {
        status: DeliveryStatus.SENT,
        provider: 'gmail',
        providerMessageId: info.messageId,
      };
    } catch (error) {
      return {
        status: DeliveryStatus.FAILED,
        provider: 'gmail',
        error: (error as Error).message,
      };
    }
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
