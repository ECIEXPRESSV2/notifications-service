import { ChannelType } from '../../notifications/notification.enums';

/**
 * Comando genérico de envío de notificación. Cualquier microservicio puede publicar
 * este evento (routing key `notification.send.requested`) para enviar una notificación
 * arbitraria por cualquier canal, sin que el servicio de notificaciones tenga que
 * conocer de antemano el evento de negocio. Es el gemelo asíncrono del endpoint
 * `POST /notifications/send`.
 *
 * Esto cumple el requisito de que TODOS los canales se puedan usar desde TODOS los
 * microservicios.
 */
export interface NotificationCommandPayload {
  /** Destinatario por id de usuario (se resuelven sus datos de contacto guardados). */
  recipientUserId?: string;
  /** Destinos explícitos (tienen prioridad sobre los datos guardados del usuario). */
  email?: string;
  phone?: string;
  deviceTokens?: string[];
  /** Canales por los que enviar. */
  channels: ChannelType[];
  /** Tipo/plantilla para clasificar la notificación (opcional). */
  type?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Clave de idempotencia opcional para evitar duplicados. */
  dedupKey?: string;
}
