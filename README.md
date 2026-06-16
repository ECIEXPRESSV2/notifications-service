# notifications-service — ECIExpress

Microservicio de **notificaciones** de ECIExpress (marketplace universitario de la
Escuela Colombiana de Ingeniería). Es un **consumidor final** del bus de eventos: recibe
eventos de todos los microservicios y envía notificaciones por **email, WhatsApp, SMS,
push y en tiempo real (in-app)**. No publica eventos de negocio.

Construido con la misma arquitectura que `financial-service`: NestJS + TypeScript,
PostgreSQL (NeonDB) con TypeORM sin `synchronize` (solo migraciones), bus RabbitMQ
(CloudAMQP) vía `@golevelup/nestjs-rabbitmq`, Swagger y logging estructurado JSON.

- Puerto: **3006**
- Exchange compartido: `eciexpress_events` (topic, durable)
- Cola propia: `notifications_service_queue` (durable)
- Bindings: `identity.#`, `order.#`, `fulfillment.#`, `financial.#`, `product.#`, `notification.#`

> 📖 **¿Vas a integrar otro microservicio?** Lee
> [`docs/INTEGRACION-EVENTOS.md`](docs/INTEGRACION-EVENTOS.md): cómo deben venir los
> eventos, todos los que recibe, y qué poner en el código para enviar por mail, WhatsApp,
> SMS, push y tiempo real.

## Cómo se notifica

Hay **dos formas** de disparar una notificación, y ambas terminan en el mismo orquestador:

1. **Por evento de negocio (automático).** El consumidor mapea cada routing key a una
   notificación usando el **catálogo** (`src/events/notification-catalog.ts`): define
   destinatario, textos en español y canales. Agregar una notificación nueva es añadir
   una entrada al catálogo; no se toca el resto del código.

2. **Comando genérico (cualquier microservicio).** Para enviar algo arbitrario por
   cualquier canal sin un evento de negocio dedicado:
   - Evento: `notification.send.requested` con
     `{ recipientUserId?, email?, phone?, deviceTokens?, channels[], title, body, data?, dedupKey? }`
   - REST equivalente: `POST /notifications/send`

   Así **todos los canales se pueden usar desde todos los microservicios**.

### Eventos cubiertos hoy

| Routing key | Notificación | Canales |
|---|---|---|
| `identity.user.registered` | Bienvenida | email, in-app |
| `identity.store.created` | Bienvenida al vendedor | email, in-app |
| `order.order.created` | Pedido creado | email, in-app, push |
| `order.order.confirmed` | Pedido pagado/confirmado | email, WhatsApp, in-app, push |
| `order.order.cancelled` | Pedido cancelado | email, in-app, push |
| `order.order.status_changed` | Cambio de estado | in-app, push |
| `order.chat.message.sent` | Nuevo mensaje | push, in-app |
| `fulfillment.qr.generated` | Código QR de entrega | email, WhatsApp |
| `fulfillment.delivery.confirmed` | Entrega confirmada | email, in-app, push |
| `fulfillment.qr.expired` | QR vencido | email, in-app, push |
| `fulfillment.delivery.failed` | Entrega fallida | email, in-app, push |
| `financial.wallet.topup.approved` | Recarga confirmada | email, WhatsApp, SMS, push, in-app |
| `financial.payment.processed` | Pago exitoso | in-app, push |
| `financial.payment.failed` | Pago fallido | email, in-app, push |
| `financial.payment.released` | Desembolso liberado (al vendedor) | email, in-app |
| `financial.refund.issued` | Reembolso | email, in-app, push |
| `product.inventory.low_stock` | Stock bajo (al vendedor) | email, in-app, push |

> **Nota de contrato:** `financial.wallet.topup.approved` ya **incluye el `userId`** del
> dueño de la billetera, así que la recarga notifica de extremo a extremo. Los demás
> eventos de Financial (payment.processed, payment.failed, refund.issued) todavía **no
> traen el `userId` del comprador**, solo `walletId`/`storeId`; mientras Financial no lo
> agregue, esas notificaciones se **omiten con log** (no se inventan destinatarios). Ver
> TODOs en `src/events/payloads/financial.payloads.ts`.

## Canales

Cada canal implementa una interfaz común (`src/channels/channel.interface.ts`) y tiene
**modo sandbox**: si faltan sus credenciales, en vez de fallar **loguea** el mensaje y lo
marca como enviado, para poder probar el flujo completo en desarrollo (igual que el
PayoutService de financial-service).

| Canal | Proveedor | Variables |
|---|---|---|
| EMAIL | Resend | `RESEND_API_KEY`, `MAIL_FROM` |
| WHATSAPP | Meta WhatsApp Cloud API (u OpenWA) | `WHATSAPP_API_URL`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN` |
| SMS | Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| PUSH | Firebase Cloud Messaging | `FCM_SERVER_KEY` |
| REALTIME | Socket.IO (WebSocket) | — (siempre disponible) |

**Tiempo real (in-app):** el cliente se conecta por WebSocket pasando su id en el
handshake (`?userId=...` o header `x-user-id`); entra a la sala `user:<id>` y recibe el
evento `notification`. La notificación también queda persistida en la bandeja in-app, así
que aunque el usuario esté offline la verá al consultar `GET /notifications`.

## Endpoints REST

Bandeja in-app y configuración del usuario (header `x-user-id`):

```
GET    /notifications                → mis notificaciones (paginadas; ?unreadOnly=true)
GET    /notifications/unread-count    → cantidad sin leer
PATCH  /notifications/:id/read        → marcar una como leída
POST   /notifications/read-all        → marcar todas como leídas

POST   /devices                       → registrar token FCM { token, platform }
GET    /devices                       → mis dispositivos
DELETE /devices/:token                → eliminar token

GET    /preferences                   → mis preferencias de canal
PATCH  /preferences                   → activar/desactivar canales
```

Uso interno (otros microservicios vía gateway) y pruebas:

```
POST   /notifications/send            → enviar notificación directa por cualquier canal
```

`GET /health` para el healthcheck. Swagger en `/api`.

## Modelo de datos (6 tablas)

- `recipients` — proyección de contacto de usuarios (desde Identity)
- `notification_stores` — proyección de tiendas para resolver al dueño
- `device_tokens` — tokens FCM para push
- `notification_preferences` — preferencias de canal por usuario
- `notifications` — notificación lógica + bandeja in-app (`dedup_key` para idempotencia)
- `notification_deliveries` — resultado de cada intento de entrega por canal

## Puesta en marcha

```bash
pnpm install
cp .env.example .env      # completar DATABASE_URL y RABBITMQ_URL (mínimo)
pnpm run migration:run    # crear las tablas en NeonDB
pnpm run start:dev        # levanta en el puerto 3006 + Swagger en /api
```

Sin credenciales de los proveedores, los canales funcionan en **sandbox** (loguean en
consola). Para envíos reales, completar las variables de cada canal en `.env`.

## Reglas técnicas heredadas

- `synchronize` siempre en `false`; tablas solo por migraciones CLI.
- Este servicio **no llama a otros microservicios por HTTP**: toda la info externa llega
  por el bus. La proyección de contacto se construye desde eventos de Identity.
- Handlers idempotentes: `dedup_key` único + upserts; los eventos pueden llegar duplicados.
- Credenciales solo por variables de entorno, nunca en el código.
- Nombres de código en inglés, comentarios en español.
