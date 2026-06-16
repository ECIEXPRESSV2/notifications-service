/**
 * Enums compartidos del dominio de notificaciones.
 *
 * Viven en un archivo neutro (sin dependencias de entidades ni de canales) para que
 * tanto las entidades de TypeORM como los proveedores de canal y los DTOs puedan
 * importarlos sin generar ciclos de importación.
 */

/** Medios por los que se puede enviar una notificación. */
export enum ChannelType {
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
  PUSH = 'PUSH',
  REALTIME = 'REALTIME',
}

/** Estado del intento de entrega por un canal concreto. */
export enum DeliveryStatus {
  PENDING = 'PENDING', // creado, aún no se intenta
  SENT = 'SENT', // entregado al proveedor con éxito
  FAILED = 'FAILED', // el proveedor rechazó o falló el envío
  SKIPPED = 'SKIPPED', // no se envió (sin destino, canal desactivado por el usuario, etc.)
}
