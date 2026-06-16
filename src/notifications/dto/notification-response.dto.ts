import { ApiProperty } from '@nestjs/swagger';
import { ChannelType, DeliveryStatus } from '../notification.enums';
import { Notification } from '../entities/notification.entity';

class DeliverySummaryDto {
  @ApiProperty({ enum: ChannelType })
  channel: ChannelType;

  @ApiProperty({ enum: DeliveryStatus })
  status: DeliveryStatus;

  @ApiProperty({ nullable: true })
  provider: string | null;
}

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  data: Record<string, unknown> | null;

  @ApiProperty()
  read: boolean;

  @ApiProperty({ nullable: true })
  readAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: [DeliverySummaryDto] })
  deliveries: DeliverySummaryDto[];

  static fromEntity(notification: Notification): NotificationResponseDto {
    const dto = new NotificationResponseDto();
    dto.id = notification.id;
    dto.type = notification.type;
    dto.title = notification.title;
    dto.body = notification.body;
    dto.data = notification.data ?? null;
    dto.read = notification.readAt != null;
    dto.readAt = notification.readAt ?? null;
    dto.createdAt = notification.createdAt;
    dto.deliveries = (notification.deliveries ?? []).map((d) => ({
      channel: d.channel,
      status: d.status,
      provider: d.provider ?? null,
    }));
    return dto;
  }
}
