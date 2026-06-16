import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { DeviceToken } from './entities/device-token.entity';

@ApiTags('Devices')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Registrar el token FCM del dispositivo actual para recibir push (header x-user-id).',
  })
  @ApiOkResponse({ type: DeviceToken })
  register(
    @CurrentUser() userId: string,
    @Body() dto: RegisterDeviceDto,
  ): Promise<DeviceToken> {
    return this.devicesService.register(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar mis dispositivos registrados.' })
  @ApiOkResponse({ type: [DeviceToken] })
  list(@CurrentUser() userId: string): Promise<DeviceToken[]> {
    return this.devicesService.findActiveByUser(userId);
  }

  @Delete(':token')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un token (al cerrar sesión).' })
  async unregister(
    @CurrentUser() userId: string,
    @Param('token') token: string,
  ): Promise<void> {
    await this.devicesService.unregister(userId, token);
  }
}
