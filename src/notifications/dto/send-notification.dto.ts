import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ChannelType } from '../notification.enums';

/**
 * Envío directo de una notificación. Lo usan otros microservicios (vía gateway) o el
 * propio equipo para pruebas. Es el gemelo síncrono del evento
 * `notification.send.requested`.
 *
 * Se debe indicar al menos un destinatario: `recipientUserId` (se resuelven sus datos
 * de contacto guardados) y/o destinos explícitos (`email`, `phone`, `deviceTokens`).
 */
export class SendNotificationDto {
  @ApiPropertyOptional({
    description:
      'Id del usuario destinatario (se resuelven sus datos de contacto).',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  recipientUserId?: string;

  @ApiPropertyOptional({ description: 'Email destino explícito.' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Teléfono destino explícito (E.164).' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Canales por los que enviar.',
    enum: ChannelType,
    isArray: true,
    example: [ChannelType.EMAIL, ChannelType.REALTIME],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ChannelType, { each: true })
  channels: ChannelType[];

  @ApiPropertyOptional({
    description: 'Tipo/plantilla para clasificar la notificación.',
    example: 'custom.announcement',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ description: 'Título de la notificación.' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Cuerpo de la notificación.' })
  @IsString()
  body: string;

  @ApiPropertyOptional({
    description: 'Datos extra (deep-link, ids, etc.).',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Clave de idempotencia para evitar duplicados.',
  })
  @IsOptional()
  @IsString()
  dedupKey?: string;
}
