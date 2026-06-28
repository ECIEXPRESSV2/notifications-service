import { Injectable, Logger } from '@nestjs/common';
import { ConsumedEvents } from './event-patterns';
import { isCatalogued } from './notification-catalog';
import { RecipientsService } from '../recipients/recipients.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCommandPayload } from './payloads/notification-command.payload';

/**
 * Único punto de consumo del bus. Enlaza la cola propia `notifications_service_queue`
 * al exchange topic compartido con los patrones comodín requeridos y, por cada mensaje:
 *
 *  1. Mantiene las proyecciones locales (datos de contacto de usuarios y dueños de
 *     tienda) a partir de los eventos de Identity.
 *  2. Atiende el comando genérico `notification.send.requested`.
 *  3. Convierte el evento en una notificación según el catálogo y la despacha.
 *
 * El orden importa: primero se actualiza la proyección (para que la notificación de
 * bienvenida ya tenga el email/dueño), luego se despacha. Todo el procesamiento es
 * idempotente porque los eventos pueden llegar duplicados.
 */
@Injectable()
export class EventConsumerService {
  private readonly logger = new Logger(EventConsumerService.name);

  constructor(
    private readonly recipientsService: RecipientsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Procesa un evento del bus. Lo invoca el suscriptor de Service Bus
   * (ServiceBusSubscriberService) con el routing-key (Subject del mensaje) y el body
   * ya deserializado. Es agnóstico del transporte y captura los errores de datos
   * internamente (idempotente) para no reencolar/poison-loop un evento que falla.
   */
  async handleEvent(
    routingKey: string,
    body: Record<string, any>,
  ): Promise<void> {
    this.logger.log(`Evento recibido: ${routingKey}`);

    try {
      // 1. Sincronizar proyecciones locales desde Identity.
      await this.syncProjection(routingKey, body);

      // 2. Comando directo de envío.
      if (routingKey === ConsumedEvents.SEND_REQUESTED) {
        await this.notificationsService.handleSendCommand(
          body as unknown as NotificationCommandPayload,
        );
        return;
      }

      // 3. Notificación derivada del catálogo de eventos.
      if (isCatalogued(routingKey)) {
        await this.notificationsService.handleDomainEvent(routingKey, body);
      } else {
        this.logger.debug(`Routing key sin notificación: ${routingKey}`);
      }
    } catch (error) {
      // Se loguea y se deja terminar (ack) para no reencolar indefinidamente un evento
      // que falla por datos. El procesamiento ya es idempotente.
      this.logger.error(
        `Error procesando ${routingKey}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /** Actualiza las proyecciones locales (usuarios y tiendas) según el evento de Identity. */
  private async syncProjection(
    routingKey: string,
    body: Record<string, any>,
  ): Promise<void> {
    switch (routingKey) {
      case ConsumedEvents.USER_REGISTERED:
        await this.recipientsService.handleUserRegistered(body as any);
        break;
      case ConsumedEvents.USER_PROFILE_UPDATED:
        await this.recipientsService.handleUserProfileUpdated(body as any);
        break;
      case ConsumedEvents.USER_DEACTIVATED:
        await this.recipientsService.handleUserDeactivated(body as any);
        break;
      case ConsumedEvents.STORE_CREATED:
        await this.recipientsService.handleStoreCreated(body as any);
        break;
      case ConsumedEvents.STORE_UPDATED:
      case ConsumedEvents.STORE_STATUS_CHANGED:
        await this.recipientsService.handleStoreUpdated(body as any);
        break;
      default:
        // No es un evento de proyección; no hay nada que sincronizar.
        break;
    }
  }
}
