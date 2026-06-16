import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from './entities/notification-preference.entity';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ChannelType } from '../notifications/notification.enums';

/**
 * Preferencias de canal por usuario. Si un usuario no tiene fila de preferencias, se
 * asume que todos los canales están habilitados (comportamiento por defecto opt-out).
 */
@Injectable()
export class PreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly prefs: Repository<NotificationPreference>,
  ) {}

  async getOrCreate(userId: string): Promise<NotificationPreference> {
    const existing = await this.prefs.findOne({ where: { userId } });
    if (existing) return existing;
    return this.prefs.save(this.prefs.create({ userId }));
  }

  async update(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<NotificationPreference> {
    const pref = await this.getOrCreate(userId);
    Object.assign(pref, dto);
    return this.prefs.save(pref);
  }

  /**
   * Indica si el usuario tiene habilitado un canal. Sin fila de preferencias todos los
   * canales se consideran habilitados.
   */
  async isChannelEnabled(
    userId: string,
    channel: ChannelType,
  ): Promise<boolean> {
    const pref = await this.prefs.findOne({ where: { userId } });
    if (!pref) return true;
    switch (channel) {
      case ChannelType.EMAIL:
        return pref.emailEnabled;
      case ChannelType.WHATSAPP:
        return pref.whatsappEnabled;
      case ChannelType.SMS:
        return pref.smsEnabled;
      case ChannelType.PUSH:
        return pref.pushEnabled;
      case ChannelType.REALTIME:
        return pref.realtimeEnabled;
      default:
        return true;
    }
  }
}
