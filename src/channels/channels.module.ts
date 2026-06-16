import { Module } from '@nestjs/common';
import { EmailChannel } from './email.channel';
import { WhatsappChannel } from './whatsapp.channel';
import { SmsChannel } from './sms.channel';
import { PushChannel } from './push.channel';
import { RealtimeChannel } from './realtime.channel';
import { RealtimeGateway } from './realtime.gateway';
import { ChannelDispatcherService } from './channel-dispatcher.service';

/**
 * Agrupa todos los canales de envío y el dispatcher. Exporta el dispatcher y el
 * gateway de tiempo real para que el módulo de notificaciones los use.
 */
@Module({
  providers: [
    EmailChannel,
    WhatsappChannel,
    SmsChannel,
    PushChannel,
    RealtimeChannel,
    RealtimeGateway,
    ChannelDispatcherService,
  ],
  exports: [ChannelDispatcherService, RealtimeGateway],
})
export class ChannelsModule {}
