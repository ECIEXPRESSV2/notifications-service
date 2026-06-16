import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PreferencesService } from './preferences.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { NotificationPreference } from './entities/notification-preference.entity';

@ApiTags('Preferences')
@Controller('preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar mis preferencias de canal (header x-user-id).',
  })
  @ApiOkResponse({ type: NotificationPreference })
  get(@CurrentUser() userId: string): Promise<NotificationPreference> {
    return this.preferencesService.getOrCreate(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Actualizar mis preferencias de canal.' })
  @ApiOkResponse({ type: NotificationPreference })
  update(
    @CurrentUser() userId: string,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<NotificationPreference> {
    return this.preferencesService.update(userId, dto);
  }
}
