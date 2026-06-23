import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar mis notificaciones (bandeja in-app, header x-user-id).',
  })
  @ApiOkResponse({ type: [NotificationResponseDto] })
  async list(
    @CurrentUser() userId: string,
    @Query() query: QueryNotificationsDto,
  ): Promise<NotificationResponseDto[]> {
    const notifications = await this.notificationsService.listForUser(
      userId,
      query,
    );
    return notifications.map((n) => NotificationResponseDto.fromEntity(n));
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Cantidad de notificaciones sin leer.' })
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  async unreadCount(@CurrentUser() userId: string): Promise<{ count: number }> {
    return { count: await this.notificationsService.unreadCount(userId) };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar una notificación como leída.' })
  @ApiOkResponse({ type: NotificationResponseDto })
  async markRead(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notificationsService.markRead(userId, id);
    return NotificationResponseDto.fromEntity(notification);
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marcar todas mis notificaciones como leídas.' })
  @ApiOkResponse({ schema: { example: { updated: 5 } } })
  markAllRead(@CurrentUser() userId: string): Promise<{ updated: number }> {
    return this.notificationsService.markAllRead(userId);
  }

  @Post('send')
  @ApiOperation({
    summary:
      'Enviar una notificación directa por cualquier canal. Pensado para uso interno ' +
      'de otros microservicios (vía gateway) y para pruebas; es el gemelo síncrono del ' +
      'evento notification.send.requested.',
  })
  @ApiOkResponse({ type: NotificationResponseDto })
  async send(
    @Body() dto: SendNotificationDto,
  ): Promise<NotificationResponseDto> {
    // NOTA: en producción este endpoint debe quedar restringido al tráfico interno
    // (service-to-service) en el API Gateway, no expuesto al público.
    const notification = await this.notificationsService.dispatch({
      recipientUserId: dto.recipientUserId ?? null,
      emailOverride: dto.email,
      phoneOverride: dto.phone,
      channels: dto.channels,
      type: dto.type ?? 'custom',
      title: dto.title,
      body: dto.body,
      data: dto.data,
      sourceService: 'api',
      dedupKey: dto.dedupKey,
    });
    return NotificationResponseDto.fromEntity(notification);
  }
}
