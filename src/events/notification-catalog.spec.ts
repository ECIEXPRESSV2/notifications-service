import { NotificationCatalog, isCatalogued } from './notification-catalog';
import { ConsumedEvents } from './event-patterns';
import { ChannelType } from '../notifications/notification.enums';

describe('NotificationCatalog', () => {
  it('mapea user.registered a una bienvenida por email + realtime al usuario', () => {
    const built = NotificationCatalog[ConsumedEvents.USER_REGISTERED]({
      userId: 'u1',
      email: 'ana@example.com',
      fullName: 'Ana',
    });
    expect(built).not.toBeNull();
    expect(built!.audience).toBe('user');
    expect(built!.userId).toBe('u1');
    expect(built!.channels).toEqual([ChannelType.EMAIL, ChannelType.REALTIME]);
    expect(built!.title).toContain('Bienvenido');
  });

  it('mapea order.confirmed con monto formateado e incluye WhatsApp', () => {
    const built = NotificationCatalog[ConsumedEvents.ORDER_CONFIRMED]({
      orderId: 'o1',
      buyerId: 'u2',
    });
    expect(built!.userId).toBe('u2');
    expect(built!.channels).toContain(ChannelType.WHATSAPP);
    expect(built!.dedupSeed).toBe('o1');
  });

  it('dirige payment.released al dueño de la tienda (audience store)', () => {
    const built = NotificationCatalog[ConsumedEvents.PAYMENT_RELEASED]({
      orderId: 'o1',
      storeId: 's1',
      storePayoutAmount: 1500000,
    });
    expect(built!.audience).toBe('store');
    expect(built!.storeId).toBe('s1');
    expect(built!.body).toContain('$15.000');
  });

  it('omite (null) los eventos financieros sin userId del comprador', () => {
    const built = NotificationCatalog[ConsumedEvents.REFUND_ISSUED]({
      orderId: 'o1',
      refundedAmount: 1000,
    });
    expect(built).toBeNull();
  });

  it('isCatalogued reconoce solo las routing keys con notificación', () => {
    expect(isCatalogued(ConsumedEvents.USER_REGISTERED)).toBe(true);
    expect(isCatalogued('identity.user.profile_updated')).toBe(false);
    expect(isCatalogued('algo.desconocido')).toBe(false);
  });
});
