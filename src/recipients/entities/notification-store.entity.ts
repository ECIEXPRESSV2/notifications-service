import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Proyección local mínima de los negocios. Sirve para resolver a qué usuario (dueño)
 * hay que notificar cuando un evento apunta a una tienda (ej. `LowStockAlert` o el
 * desembolso liberado al vendedor).
 *
 * Se llena desde `identity.store.created` / `identity.store.updated`. El `owner_user_id`
 * solo se guarda si el evento lo trae; si no, las notificaciones dirigidas a la tienda
 * se omiten con un log (no se inventan destinatarios).
 */
@Entity('notification_stores')
export class NotificationStore {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  name?: string | null;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId?: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
