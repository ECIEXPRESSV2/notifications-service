import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recipient } from './entities/recipient.entity';
import { NotificationStore } from './entities/notification-store.entity';
import { RecipientsService } from './recipients.service';

@Module({
  imports: [TypeOrmModule.forFeature([Recipient, NotificationStore])],
  providers: [RecipientsService],
  exports: [RecipientsService],
})
export class RecipientsModule {}
