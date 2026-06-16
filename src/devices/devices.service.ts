import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { NotificationLogger } from '../common/logger/notification.logger';

/**
 * Gestiona los tokens de dispositivo para push (FCM). El canal PUSH consulta aquí los
 * tokens activos del usuario al momento de enviar.
 */
@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(DeviceToken)
    private readonly devices: Repository<DeviceToken>,
    private readonly logger: NotificationLogger,
  ) {}

  /**
   * Registra (o reactiva) un token para un usuario. El token es único: si ya existía
   * —aunque fuera de otro usuario o desactivado— se reasigna al usuario actual. Idempotente.
   */
  async register(userId: string, dto: RegisterDeviceDto): Promise<DeviceToken> {
    const existing = await this.devices.findOne({
      where: { token: dto.token },
    });
    const device = existing ?? this.devices.create({ token: dto.token });
    device.userId = userId;
    device.platform = dto.platform;
    device.isActive = true;
    const saved = await this.devices.save(device);
    this.logger.logEvent('device.registered', 'Dispositivo registrado', {
      userId,
      platform: dto.platform,
    });
    return saved;
  }

  /** Desactiva un token (al cerrar sesión). */
  async unregister(userId: string, token: string): Promise<void> {
    await this.devices.update({ token, userId }, { isActive: false });
  }

  /** Lista los tokens activos del usuario. */
  findActiveByUser(userId: string): Promise<DeviceToken[]> {
    return this.devices.find({ where: { userId, isActive: true } });
  }

  /** Tokens activos como simple array de strings (para el canal push). */
  async getActiveTokens(userId: string): Promise<string[]> {
    const devices = await this.findActiveByUser(userId);
    return devices.map((d) => d.token);
  }
}
