import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Preferencias de canal por usuario. Permite que un usuario desactive canales
 * concretos (ej. no recibir SMS). Por defecto todos los canales están habilitados.
 *
 * El dispatcher consulta estas preferencias antes de enviar y marca como SKIPPED
 * (motivo `channel_disabled_by_user`) los canales que el usuario desactivó.
 */
@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ name: 'email_enabled', default: true })
  emailEnabled: boolean;

  @Column({ name: 'whatsapp_enabled', default: true })
  whatsappEnabled: boolean;

  @Column({ name: 'sms_enabled', default: true })
  smsEnabled: boolean;

  @Column({ name: 'realtime_enabled', default: true })
  realtimeEnabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
