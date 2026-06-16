import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recipient } from './entities/recipient.entity';
import { NotificationStore } from './entities/notification-store.entity';
import { NotificationLogger } from '../common/logger/notification.logger';
import {
  UserRegisteredPayload,
  UserProfileUpdatedPayload,
  UserDeactivatedPayload,
  StoreCreatedPayload,
  StoreUpdatedPayload,
} from '../events/payloads/identity.payloads';

/**
 * Mantiene la proyección local de usuarios (datos de contacto) y de negocios (para
 * resolver el dueño al que notificar). Se alimenta de los eventos de Identity. Todos
 * los handlers son idempotentes (upsert), porque los eventos pueden llegar duplicados.
 */
@Injectable()
export class RecipientsService {
  constructor(
    @InjectRepository(Recipient)
    private readonly recipients: Repository<Recipient>,
    @InjectRepository(NotificationStore)
    private readonly stores: Repository<NotificationStore>,
    private readonly logger: NotificationLogger,
  ) {}

  // ----------------------------------------------------------- Identity: user

  async handleUserRegistered(payload: UserRegisteredPayload): Promise<void> {
    if (!payload.userId) return;
    await this.recipients.save(
      this.recipients.create({
        id: payload.userId,
        email: payload.email ?? null,
        fullName: payload.fullName ?? null,
        phone: payload.phone ?? null,
        isActive: true,
      }),
    );
    this.logger.logEvent('recipient.upserted', 'Destinatario creado', {
      userId: payload.userId,
    });
  }

  async handleUserProfileUpdated(
    payload: UserProfileUpdatedPayload,
  ): Promise<void> {
    if (!payload.userId) return;
    const recipient =
      (await this.recipients.findOne({ where: { id: payload.userId } })) ??
      this.recipients.create({ id: payload.userId, isActive: true });

    const values = payload.newValues ?? {};
    if (values.email !== undefined) recipient.email = values.email;
    if (values.phone !== undefined) recipient.phone = values.phone;
    if (values.fullName !== undefined) recipient.fullName = values.fullName;

    await this.recipients.save(recipient);
    this.logger.logEvent('recipient.upserted', 'Destinatario actualizado', {
      userId: payload.userId,
    });
  }

  async handleUserDeactivated(payload: UserDeactivatedPayload): Promise<void> {
    if (!payload.userId) return;
    await this.recipients.update({ id: payload.userId }, { isActive: false });
  }

  // ---------------------------------------------------------- Identity: store

  async handleStoreCreated(payload: StoreCreatedPayload): Promise<void> {
    if (!payload.storeId) return;
    await this.stores.save(
      this.stores.create({
        id: payload.storeId,
        name: payload.name ?? null,
        ownerUserId: payload.ownerId ?? null,
        isActive: true,
      }),
    );
  }

  async handleStoreUpdated(payload: StoreUpdatedPayload): Promise<void> {
    if (!payload.storeId) return;
    const store = await this.stores.findOne({
      where: { id: payload.storeId },
    });
    if (!store) {
      // Aún no teníamos proyección de esta tienda: la creamos con lo disponible.
      await this.stores.save(
        this.stores.create({
          id: payload.storeId,
          name: payload.name ?? null,
          isActive: payload.status ? payload.status !== 'CLOSED' : true,
        }),
      );
      return;
    }
    if (payload.name !== undefined) store.name = payload.name;
    await this.stores.save(store);
  }

  // ------------------------------------------------------------- Resolvers

  /** Datos de contacto del usuario, o null si no lo conocemos. */
  findRecipient(userId: string): Promise<Recipient | null> {
    return this.recipients.findOne({ where: { id: userId } });
  }

  /** Resuelve el id del usuario dueño de una tienda para poder notificarle. */
  async resolveStoreOwner(storeId: string): Promise<string | null> {
    const store = await this.stores.findOne({ where: { id: storeId } });
    return store?.ownerUserId ?? null;
  }
}
