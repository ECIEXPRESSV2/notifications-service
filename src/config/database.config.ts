import { registerAs } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { join } from 'path';
import { Recipient } from '../recipients/entities/recipient.entity';
import { NotificationStore } from '../recipients/entities/notification-store.entity';
import { NotificationPreference } from '../preferences/entities/notification-preference.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationDelivery } from '../notifications/entities/notification-delivery.entity';

/**
 * Configuración de TypeORM para PostgreSQL en NeonDB.
 *
 * Reglas obligatorias:
 * - synchronize SIEMPRE en false: las tablas solo se crean/alteran via migraciones CLI.
 * - autoLoadEntities NO se usa: las entidades se registran explícitamente.
 */
export const databaseConfig = registerAs(
  'database',
  (): DataSourceOptions => ({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // NeonDB requiere SSL (sslmode=require)
    entities: [
      Recipient,
      NotificationStore,
      NotificationPreference,
      Notification,
      NotificationDelivery,
    ],
    migrations: [join(__dirname, '..', 'database', 'migrations', '*{.ts,.js}')],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
  }),
);
