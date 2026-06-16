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
 * Canal de WhatsApp con dos proveedores intercambiables (`WHATSAPP_PROVIDER`):
 *
 * - `cloud` (por defecto): WhatsApp Cloud API de Meta (graph.facebook.com). Oficial;
 *   tiene capa gratuita con un número de prueba que envía a destinatarios verificados.
 *   Requiere `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_TOKEN`.
 *
 * - `openwa`: servidor OpenWA (@open-wa/wa-automate) corriendo aparte, que expone
 *   WhatsApp Web por REST. Es 100% gratis (no usa Meta) pero no oficial. Se levanta con
 *   `npx @open-wa/wa-automate --api -p 8002 [--api-key <key>]` y se escanea el QR. Aquí
 *   solo se necesita `WHATSAPP_API_URL` (p.ej. http://localhost:8002) y opcionalmente
 *   `WHATSAPP_OPENWA_API_KEY`.
 *
 * Si faltan las credenciales del proveedor elegido, el canal entra en modo sandbox y
 * solo loguea el mensaje (igual que el resto de canales).
 */
@Injectable()
export class WhatsappChannel implements NotificationChannel {
  readonly type = ChannelType.WHATSAPP;
  private readonly logger = new Logger(WhatsappChannel.name);

  constructor(private readonly config: ConfigService) {}

  async send(message: ChannelMessage): Promise<ChannelResult> {
    const provider =
      this.config.get<'cloud' | 'openwa'>('channels.whatsapp.provider') ??
      'cloud';

    if (!message.destination) {
      return {
        status: DeliveryStatus.SKIPPED,
        provider: 'whatsapp',
        error: 'no_destination',
      };
    }

    const text = message.title
      ? `*${message.title}*\n${message.body}`
      : message.body;

    return provider === 'openwa'
      ? this.sendViaOpenWa(message.destination, text)
      : this.sendViaCloud(message.destination, text);
  }

  /** Envío por la WhatsApp Cloud API de Meta. */
  private async sendViaCloud(
    destination: string,
    text: string,
  ): Promise<ChannelResult> {
    const apiUrl = this.config.get<string>('channels.whatsapp.apiUrl')!;
    const phoneNumberId = this.config.get<string>(
      'channels.whatsapp.phoneNumberId',
    );
    const token = this.config.get<string>('channels.whatsapp.token');

    if (!token || !phoneNumberId) {
      this.logger.log(
        `[SANDBOX WHATSAPP/cloud] a=${destination} mensaje="${text}"`,
      );
      return { status: DeliveryStatus.SENT, provider: 'sandbox' };
    }

    try {
      const response = await axios.post<{ messages?: { id: string }[] }>(
        `${apiUrl}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: this.normalizePhone(destination),
          type: 'text',
          text: { body: text },
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10_000,
        },
      );
      return {
        status: DeliveryStatus.SENT,
        provider: 'whatsapp-cloud',
        providerMessageId: response.data?.messages?.[0]?.id,
      };
    } catch (error) {
      return {
        status: DeliveryStatus.FAILED,
        provider: 'whatsapp-cloud',
        error: this.describeError(error),
      };
    }
  }

  /**
   * Envío por un servidor OpenWA. Su API REST expone `POST /sendText` con el cuerpo
   * `{ args: { to, content } }` y `api_key` por header. El destino se forma como
   * `<numero>@c.us`.
   */
  private async sendViaOpenWa(
    destination: string,
    text: string,
  ): Promise<ChannelResult> {
    const apiUrl = this.config.get<string>('channels.whatsapp.apiUrl');
    const apiKey = this.config.get<string>('channels.whatsapp.apiKey');

    // Sin una URL propia de OpenWA (la default apunta a Meta), no hay servidor: sandbox.
    if (!apiUrl || apiUrl.includes('graph.facebook.com')) {
      this.logger.log(
        `[SANDBOX WHATSAPP/openwa] a=${destination} mensaje="${text}"`,
      );
      return { status: DeliveryStatus.SENT, provider: 'sandbox' };
    }

    try {
      const response = await axios.post<{ response?: { id?: string } }>(
        `${apiUrl.replace(/\/$/, '')}/sendText`,
        { args: { to: `${this.normalizePhone(destination)}@c.us`, content: text } },
        {
          headers: apiKey ? { api_key: apiKey } : undefined,
          timeout: 15_000,
        },
      );
      return {
        status: DeliveryStatus.SENT,
        provider: 'whatsapp-openwa',
        providerMessageId: response.data?.response?.id,
      };
    } catch (error) {
      return {
        status: DeliveryStatus.FAILED,
        provider: 'whatsapp-openwa',
        error: this.describeError(error),
      };
    }
  }

  /** WhatsApp espera el número sin el `+` inicial ni separadores. */
  private normalizePhone(phone: string): string {
    return phone.replace(/[^\d]/g, '');
  }

  private describeError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      return `${error.response?.status ?? ''} ${JSON.stringify(error.response?.data ?? error.message)}`.trim();
    }
    return (error as Error).message;
  }
}
