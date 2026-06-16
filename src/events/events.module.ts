import { Module } from '@nestjs/common';
import { RecipientsModule } from '../recipients/recipients.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventConsumerService } from './event-consumer.service';

/**
 * Registra el consumidor del bus. Importa los módulos de dominio para inyectar sus
 * servicios en el dispatcher. La conexión vive en MessagingModule (global).
 */
@Module({
  imports: [RecipientsModule, NotificationsModule],
  providers: [EventConsumerService],
})
export class EventsModule {}
