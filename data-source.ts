import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Recipient } from './src/recipients/entities/recipient.entity';
import { NotificationStore } from './src/recipients/entities/notification-store.entity';
import { DeviceToken } from './src/devices/entities/device-token.entity';
import { NotificationPreference } from './src/preferences/entities/notification-preference.entity';
import { Notification } from './src/notifications/entities/notification.entity';
import { NotificationDelivery } from './src/notifications/entities/notification-delivery.entity';

dotenv.config();

/**
 * DataSource para el CLI de TypeORM (migration:generate / run / revert).
 * synchronize SIEMPRE en false: las tablas se crean exclusivamente con migraciones.
 */
const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  entities: [
    Recipient,
    NotificationStore,
    DeviceToken,
    NotificationPreference,
    Notification,
    NotificationDelivery,
  ],
  migrations: ['src/database/migrations/*{.ts,.js}'],
  synchronize: false,
});

export default AppDataSource;
