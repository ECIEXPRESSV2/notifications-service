/**
 * Payloads de los eventos de Product Management que consume este servicio.
 */

/**
 * routing key: `product.inventory.low_stock` (LowStockAlert).
 * Campos tal como los publica products-service (`checkAndPublishLowStock`).
 */
export interface LowStockAlertPayload {
  productId: string;
  storeId: string; // se notifica al dueño del negocio
  /** Nombre del producto. */
  name: string;
  /** Stock total actual. */
  stock: number;
  /** Stock reservado (en carritos/órdenes sin confirmar). */
  reservedStock: number;
  /** Umbral mínimo configurado para el producto. */
  minStock: number;
}
