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

/**
 * Canal de correo electrónico. Usa Resend (https://resend.com) vía su API HTTP.
 *
 * Si no hay `RESEND_API_KEY` configurada, el canal entra en modo sandbox: loguea el
 * correo en consola y lo marca como SENT con proveedor `sandbox`. Esto permite probar
 * todo el flujo en desarrollo sin una cuenta real (mismo principio que el PayoutService
 * del financial-service en sandbox).
 *
 * El cuerpo se envía como texto plano por simplicidad; en producción conviene una
 * plantilla HTML por tipo de notificación.
 */
@Injectable()
export class EmailChannel implements NotificationChannel {
  readonly type = ChannelType.EMAIL;
  private readonly logger = new Logger(EmailChannel.name);

  constructor(
    private readonly config: ConfigService,
    private readonly templates: TemplateService,
  ) {}

  async send(message: ChannelMessage): Promise<ChannelResult> {
    const apiKey = this.config.get<string>('channels.email.resendApiKey');
    const from = this.config.get<string>('channels.email.from')!;

    if (!message.destination) {
      return {
        status: DeliveryStatus.SKIPPED,
        provider: 'resend',
        error: 'no_destination',
      };
    }

    const html = message.sourceEvent
      ? this.templates.render(message.sourceEvent, this.buildTemplateVars(message))
      : null;

    if (!apiKey) {
      this.logger.log(
        `[SANDBOX EMAIL] a=${message.destination} asunto="${message.title}" template=${message.type ?? 'none'}`,
      );
      return { status: DeliveryStatus.SENT, provider: 'sandbox' };
    }

    try {
      const response = await axios.post<{ id: string }>(
        'https://api.resend.com/emails',
        {
          from,
          to: message.destination,
          subject: message.title,
          ...(html ? { html } : { text: message.body }),
        },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 10_000,
        },
      );
      return {
        status: DeliveryStatus.SENT,
        provider: 'resend',
        providerMessageId: response.data?.id,
      };
    } catch (error) {
      return {
        status: DeliveryStatus.FAILED,
        provider: 'resend',
        error: this.describeError(error),
      };
    }
  }

  private buildTemplateVars(message: ChannelMessage): Record<string, unknown> {
    const data = message.data ?? {};
    return {
      title: message.title,
      body: message.body,
      // Espacio previo incluido para que "Hola{{recipientName}}," quede natural
      recipientName: message.recipientName ? ` ${message.recipientName}` : '',
      year: new Date().getFullYear(),
      ...data,
      // Versión formateada del amount si el campo existe (centavos → pesos COP)
      ...(typeof data.amount === 'number'
        ? { amountFormatted: formatCop(data.amount) }
        : {}),
    };
  }

  private describeError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      return `${error.response?.status ?? ''} ${JSON.stringify(error.response?.data ?? error.message)}`.trim();
    }
    return (error as Error).message;
  }
}
