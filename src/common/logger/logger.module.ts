import { Global, Module } from '@nestjs/common';
import { NotificationLogger } from './notification.logger';

@Global()
@Module({
  providers: [NotificationLogger],
  exports: [NotificationLogger],
})
export class LoggerModule {}
