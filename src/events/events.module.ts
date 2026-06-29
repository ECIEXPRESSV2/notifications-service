import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RecipientsModule } from '../recipients/recipients.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventConsumerService } from './event-consumer.service';
import { ServiceBusSubscriberService } from './service-bus-subscriber.service';

/**
 * Registra el consumidor del bus y el suscriptor de Service Bus que lo alimenta.
 * Importa los módulos de dominio para inyectar sus servicios en el dispatcher. El
 * ServiceBusClient vive en MessagingModule (global).
 */
@Module({
  imports: [ConfigModule, RecipientsModule, NotificationsModule],
  providers: [EventConsumerService, ServiceBusSubscriberService],
})
export class EventsModule {}
