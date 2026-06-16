/**
 * Payloads de los eventos de Product Management que consume este servicio.
 * TODO: alinear con el contrato definitivo del event catalog de Product.
 */

/** routing key: `product.inventory.low_stock` (LowStockAlert) */
export interface LowStockAlertPayload {
  productId: string;
  storeId: string; // se notifica al dueño del negocio
  productName?: string;
  remainingStock?: number;
}
