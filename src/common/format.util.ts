/**
 * Utilidades de formato para los textos de las notificaciones.
 */

/**
 * Formatea un monto en centavos de peso colombiano (como lo manejan el resto de
 * microservicios) a un string legible. Ej: 1234500 -> "$12.345".
 *
 * Se evita Intl.NumberFormat para no depender de que el runtime tenga ICU completo;
 * el separador de miles se inserta manualmente con el estilo colombiano (punto).
 */
export function formatCop(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) {
    return '$0';
  }
  const pesos = Math.round(cents / 100);
  const withSeparators = pesos.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$${withSeparators}`;
}

/** Enmascara un destino (email/teléfono/token) para no loguearlo completo. */
export function maskDestination(destination?: string | null): string | null {
  if (!destination) {
    return null;
  }
  if (destination.includes('@')) {
    const [user, domain] = destination.split('@');
    const visible = user.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`;
  }
  if (destination.length <= 4) {
    return '*'.repeat(destination.length);
  }
  return `${'*'.repeat(destination.length - 4)}${destination.slice(-4)}`;
}
