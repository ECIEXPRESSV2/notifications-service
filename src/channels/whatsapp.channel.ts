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
 * Canal de WhatsApp usando la Cloud API oficial de Meta (graph.facebook.com).
 *
 * Meta obliga a usar plantillas (HSM) aprobadas para mensajes business-initiated.
 * El texto libre solo funciona dentro de una ventana de 24h tras un mensaje del usuario.
 *
 * Estrategia:
 *  1. Si el tipo de notificación tiene un template aprobado → lo usa.
 *  2. Si no → intenta texto libre (funcionará solo si hay ventana de 24h abierta).
 *  3. Si falla por "template required" (error 131047) → SKIPPED con mensaje claro.
 *
 * Variables de entorno:
 *  - WHATSAPP_PHONE_NUMBER_ID  ID del número en Meta Business
 *  - WHATSAPP_TOKEN            Token de acceso permanente
 *  - WHATSAPP_API_URL          (opcional) base URL; default graph.facebook.com/v25.0
 */

/** Mapeo de tipo de notificación → nombre del template aprobado en Meta. */
const TEMPLATE_MAP: Record<string, { name: string; language: string }> = {
  // Template de prueba preaprobado por Meta (en inglés, disponible en todas las cuentas)
  'test': { name: 'hello_world', language: 'en_US' },
};

@Injectable()
export class WhatsappChannel implements NotificationChannel {
  readonly type = ChannelType.WHATSAPP;
  private readonly logger = new Logger(WhatsappChannel.name);

  constructor(private readonly config: ConfigService) {}

  async send(message: ChannelMessage): Promise<ChannelResult> {
    if (!message.destination) {
      return {
        status: DeliveryStatus.SKIPPED,
        provider: 'whatsapp-cloud',
        error: 'no_destination',
      };
    }

    const phoneNumberId = this.config.get<string>('channels.whatsapp.phoneNumberId');
    const token = this.config.get<string>('channels.whatsapp.token');
    const apiUrl = this.config.get<string>('channels.whatsapp.apiUrl')!;

    if (!token || !phoneNumberId) {
      const text = message.title ? `*${message.title}*\n${message.body}` : message.body;
      this.logger.log(`[SANDBOX WHATSAPP] a=${message.destination} imagen=${message.imageUrl ?? 'ninguna'} mensaje="${text}"`);
      return { status: DeliveryStatus.SENT, provider: 'sandbox' };
    }

    // Si viene una imagen, se envía como mensaje multimedia con el body como caption.
    // La URL puede ser cualquier URL pública: CDN propio, S3, o Azure Blob Storage.
    // TODO(blob-storage): cuando las imágenes estén en Azure Blob Storage pasar la URL
    // del blob aquí. Si el contenedor es privado, generar una SAS URL antes de llamar.
    // Pendiente definir: nombre del contenedor (AZURE_STORAGE_CONTAINER) y
    // connection string (AZURE_STORAGE_CONNECTION_STRING).
    if (message.imageUrl) {
      return this.sendImage(apiUrl, phoneNumberId, token, message.destination, message.imageUrl, message.body);
    }

    const template = message.type ? TEMPLATE_MAP[message.type] : undefined;

    return template
      ? this.sendTemplate(apiUrl, phoneNumberId, token, message.destination, template)
      : this.sendText(apiUrl, phoneNumberId, token, message.destination, message);
  }

  /**
   * Envío de imagen con caption. La URL puede apuntar a cualquier host público:
   * CDN propio, AWS S3, o Azure Blob Storage (contenedor público o SAS URL).
   * Meta descarga la imagen directamente desde la URL — no requiere subida previa.
   *
   * TODO(blob-storage): pendiente configurar AZURE_STORAGE_CONTAINER y
   * AZURE_STORAGE_CONNECTION_STRING cuando el almacenamiento migre a Azure.
   */
  private async sendImage(
    apiUrl: string,
    phoneNumberId: string,
    token: string,
    destination: string,
    imageUrl: string,
    caption: string,
  ): Promise<ChannelResult> {
    try {
      const response = await axios.post<{ messages?: { id: string }[] }>(
        `${apiUrl}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: this.normalizePhone(destination),
          type: 'image',
          image: { link: imageUrl, caption },
        },
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          timeout: 15_000,
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

  /** Envío con template aprobado por Meta (funciona siempre, business-initiated). */
  private async sendTemplate(
    apiUrl: string,
    phoneNumberId: string,
    token: string,
    destination: string,
    template: { name: string; language: string },
  ): Promise<ChannelResult> {
    try {
      const response = await axios.post<{ messages?: { id: string }[] }>(
        `${apiUrl}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: this.normalizePhone(destination),
          type: 'template',
          template: {
            name: template.name,
            language: { code: template.language },
          },
        },
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
   * Envío de texto libre. Solo funciona si el destinatario escribió primero
   * en las últimas 24h (ventana de sesión de Meta). Para notificaciones
   * business-initiated usar templates.
   */
  private async sendText(
    apiUrl: string,
    phoneNumberId: string,
    token: string,
    destination: string,
    message: ChannelMessage,
  ): Promise<ChannelResult> {
    const text = message.title ? `*${message.title}*\n${message.body}` : message.body;
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
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          timeout: 10_000,
        },
      );
      return {
        status: DeliveryStatus.SENT,
        provider: 'whatsapp-cloud',
        providerMessageId: response.data?.messages?.[0]?.id,
      };
    } catch (error) {
      // 131047 = mensaje fuera de ventana de 24h, requiere template
      if (axios.isAxiosError(error) && error.response?.data?.error?.code === 131047) {
        return {
          status: DeliveryStatus.SKIPPED,
          provider: 'whatsapp-cloud',
          error: 'requires_template: no hay ventana de sesión abierta con este número',
        };
      }
      return {
        status: DeliveryStatus.FAILED,
        provider: 'whatsapp-cloud',
        error: this.describeError(error),
      };
    }
  }

  /** WhatsApp Cloud API espera el número sin el `+` inicial ni separadores. */
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
