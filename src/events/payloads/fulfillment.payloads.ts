/**
 * Payloads de los eventos de Fulfillment que consume este servicio.
 * TODO: alinear con el contrato definitivo del event catalog de Fulfillment.
 */

/** routing key: `fulfillment.qr.generated` */
export interface QrGeneratedPayload {
  orderId: string;
  buyerId: string;
  qrCode?: string; // contenido o URL del QR de entrega
}

/** routing key: `fulfillment.delivery.confirmed` */
export interface DeliveryConfirmedPayload {
  orderId: string;
  buyerId: string;
}

/** routing key: `fulfillment.qr.expired` */
export interface QrExpiredPayload {
  orderId: string;
  buyerId: string;
}

/** routing key: `fulfillment.delivery.failed` */
export interface DeliveryFailedPayload {
  orderId: string;
  buyerId: string;
  reason?: string;
}
