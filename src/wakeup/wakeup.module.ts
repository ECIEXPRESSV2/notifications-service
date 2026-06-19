import { Module } from '@nestjs/common';
import { WakeupController } from './wakeup.controller';
import { WakeupService } from './wakeup.service';

@Module({
  controllers: [WakeupController],
  providers: [WakeupService],
})
export class WakeupModule {}
