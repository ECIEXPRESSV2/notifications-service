import { Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WakeupService } from './wakeup.service';

@ApiTags('Wakeup')
@Controller('wakeup')
export class WakeupController {
  private readonly logger = new Logger(WakeupController.name);

  constructor(private readonly wakeupService: WakeupService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Despertar microservicios',
    description:
      'Envía una petición al endpoint /health de cada microservicio configurado para evitar ' +
      'que Render los detenga por inactividad. Al completar los chequeos, envía un reporte ' +
      'por correo a WAKEUP_REPORT_EMAIL con el estado de cada servicio.',
  })
  @ApiResponse({ status: 202, description: 'Wakeup iniciado en segundo plano.' })
  wakeup(): { message: string; timestamp: string } {
    this.wakeupService.pingAndNotify().catch((err) => {
      this.logger.error(`Error en pingAndNotify: ${err}`);
    });

    return {
      message: 'Wakeup iniciado. Recibirás el reporte por correo cuando todos los servicios respondan.',
      timestamp: new Date().toISOString(),
    };
  }
}
