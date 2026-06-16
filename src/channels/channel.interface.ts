import {
  ChannelType,
  DeliveryStatus,
} from '../notifications/notification.enums';

/**
 * Mensaje ya renderizado que se entrega a un canal para su envío. El dispatcher
 * resuelve el destino concreto (email/teléfono/tokens) antes de invocar el canal.
 */
export interface ChannelMessage {
  /** Destino directo para EMAIL/SMS/WHATSAPP (correo o teléfono E.164). */
  destination?: string | null;
  /** Tokens de dispositivo para PUSH. */
  deviceTokens?: string[];
  /** Id de usuario para emitir por el canal REALTIME (sala = userId). */
  userId?: string | null;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
}

/** Resultado del envío por un canal. */
export interface ChannelResult {
  status: DeliveryStatus;
  provider: string;
  providerMessageId?: string;
  error?: string;
}

/**
 * Contrato común de todos los canales de notificación. Cada proveedor concreto
 * (Resend, Twilio, WhatsApp Cloud API, FCM, Socket.IO) lo implementa. Permite que el
 * dispatcher trate todos los canales de forma uniforme y que se agreguen canales
 * nuevos en el futuro sin tocar la orquestación.
 */
export interface NotificationChannel {
  readonly type: ChannelType;
  send(message: ChannelMessage): Promise<ChannelResult>;
}
