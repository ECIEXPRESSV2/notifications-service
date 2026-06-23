import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ description: 'Recibir notificaciones por email.' })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Recibir notificaciones por WhatsApp.' })
  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Recibir notificaciones por SMS.' })
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Recibir notificaciones en tiempo real dentro de la app.',
  })
  @IsOptional()
  @IsBoolean()
  realtimeEnabled?: boolean;
}
