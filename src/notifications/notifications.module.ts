import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ChannelsModule } from '../channels/channels.module';
import { RecipientsModule } from '../recipients/recipients.module';
import { PreferencesModule } from '../preferences/preferences.module';
import { DevicesModule } from '../devices/devices.module';

/**
 * Módulo central de orquestación. Reúne la persistencia de notificaciones/entregas con
 * los canales de envío y los módulos de soporte (destinatarios, preferencias,
 * dispositivos). Exporta el servicio para que el consumidor del bus lo invoque.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationDelivery]),
    ChannelsModule,
    RecipientsModule,
    PreferencesModule,
    DevicesModule,
  ],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
