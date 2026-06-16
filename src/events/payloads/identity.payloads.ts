/**
 * Payloads de los eventos de Identity que consume este servicio.
 *
 * Identity emite los eventos en PLANO (todos los campos al primer nivel, sin subnodo
 * `payload`) y añade `idempotencyKey` y `source` al sobre. Aquí se declaran solo los
 * campos mínimos que el servicio de notificaciones necesita.
 */

/** routing key: `identity.user.registered` */
export interface UserRegisteredPayload {
  userId: string;
  email?: string;
  fullName?: string;
  phone?: string; // TODO: Identity aún no envía teléfono en el registro
  systemRole?: string;
}

/** routing key: `identity.user.profile_updated` */
export interface UserProfileUpdatedPayload {
  userId: string;
  changedFields?: string[];
  newValues?: {
    email?: string;
    phone?: string;
    fullName?: string;
  };
}

/** routing key: `identity.user.deactivated` */
export interface UserDeactivatedPayload {
  userId: string;
  reason?: string;
}

/** routing key: `identity.store.created` */
export interface StoreCreatedPayload {
  storeId: string;
  ownerId?: string; // dueño del negocio: a este usuario se le notifica
  name?: string;
}

/** routing keys: `identity.store.status_changed`, `identity.store.updated` */
export interface StoreUpdatedPayload {
  storeId: string;
  name?: string;
  status?: string;
}
