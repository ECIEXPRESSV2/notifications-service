import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DevicePlatform } from '../entities/device-token.entity';

export class RegisterDeviceDto {
  @ApiProperty({
    description: 'Token de dispositivo emitido por FCM.',
    example: 'fcm_dGVzdC10b2tlbi0xMjM0NTY3ODkw',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    enum: DevicePlatform,
    description: 'Plataforma del dispositivo.',
    example: DevicePlatform.ANDROID,
  })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;
}
