import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChannelType, DeliveryStatus } from '../notification.enums';
import { Notification } from './notification.entity';

/**
 * Intento de entrega de una notificación por un canal concreto. Guarda el resultado
 * del proveedor (id del mensaje, error) para trazabilidad y reintentos manuales.
 */
@Entity('notification_deliveries')
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_notification_deliveries_notification_id')
  @Column({ name: 'notification_id', type: 'uuid' })
  notificationId: string;

  @ManyToOne(() => Notification, (notification) => notification.deliveries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'notification_id' })
  notification: Notification;

  @Column({ type: 'enum', enum: ChannelType })
  channel: ChannelType;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  status: DeliveryStatus;

  /** Proveedor concreto usado, ej. `resend`, `twilio`, `fcm`, `socket`, `sandbox`. */
  @Column({ type: 'varchar', nullable: true })
  provider?: string | null;

  /** Id del mensaje devuelto por el proveedor (para conciliación). */
  @Column({ name: 'provider_message_id', type: 'varchar', nullable: true })
  providerMessageId?: string | null;

  /** Destino enmascarado (email/teléfono/token) al que se envió. */
  @Column({ type: 'varchar', nullable: true })
  destination?: string | null;

  @Column({ type: 'text', nullable: true })
  error?: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
