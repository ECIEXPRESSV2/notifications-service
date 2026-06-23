import { Injectable } from '@nestjs/common';
import { ChannelType } from '../notifications/notification.enums';
import { ChannelMessage, ChannelResult } from './channel.interface';
import { EmailChannel } from './email.channel';
import { WhatsappChannel } from './whatsapp.channel';
import { SmsChannel } from './sms.channel';
import { RealtimeChannel } from './realtime.channel';

/**
 * Registro central de canales. Mapea cada `ChannelType` a su proveedor concreto y
 * expone un único `send(channel, message)` para que el orquestador no conozca los
 * proveedores. Agregar un canal nuevo es registrar un proveedor más aquí.
 */
@Injectable()
export class ChannelDispatcherService {
  private readonly registry: Record<
    ChannelType,
    { send(message: ChannelMessage): Promise<ChannelResult> }
  >;

  constructor(
    email: EmailChannel,
    whatsapp: WhatsappChannel,
    sms: SmsChannel,
    realtime: RealtimeChannel,
  ) {
    this.registry = {
      [ChannelType.EMAIL]: email,
      [ChannelType.WHATSAPP]: whatsapp,
      [ChannelType.SMS]: sms,
      [ChannelType.REALTIME]: realtime,
    };
  }

  send(channel: ChannelType, message: ChannelMessage): Promise<ChannelResult> {
    return this.registry[channel].send(message);
  }
}
