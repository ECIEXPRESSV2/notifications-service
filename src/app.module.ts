import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { rabbitmqConfig } from './config/rabbitmq.config';
import { channelsConfig } from './config/channels.config';
import { appConfig } from './config/app.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from './common/logger/logger.module';
import { LoggingMiddleware } from './common/logger/logging.middleware';
import { MessagingModule } from './events/messaging.module';
import { EventsModule } from './events/events.module';
import { ChannelsModule } from './channels/channels.module';
import { RecipientsModule } from './recipients/recipients.module';
import { PreferencesModule } from './preferences/preferences.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WakeupModule } from './wakeup/wakeup.module';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, rabbitmqConfig, channelsConfig, appConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      // Entidades declaradas explícitamente en database.config (sin autoLoadEntities).
      // synchronize permanece en false: las tablas solo se crean con migraciones.
      useFactory: (configService: ConfigService) =>
        configService.getOrThrow('database'),
    }),
    MessagingModule,
    ChannelsModule,
    RecipientsModule,
    PreferencesModule,
    NotificationsModule,
    EventsModule,
    WakeupModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
