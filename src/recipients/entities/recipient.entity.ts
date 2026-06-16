import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Proyección local de los usuarios de la plataforma. Guarda únicamente los datos de
 * contacto que este servicio necesita para enviar notificaciones (email, teléfono).
 *
 * El `id` es el mismo que asigna Identity y se llena/actualiza desde los eventos
 * `identity.user.registered` y `identity.user.profile_updated`. Este servicio NUNCA
 * llama a Identity por HTTP: toda la información de contacto llega por el bus.
 */
@Entity('recipients')
export class Recipient {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone?: string | null;

  @Column({ name: 'full_name', type: 'varchar', nullable: true })
  fullName?: string | null;

  @Column({ type: 'varchar', default: 'es' })
  locale: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
