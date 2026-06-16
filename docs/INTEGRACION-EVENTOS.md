# Guía de integración — notifications-service

Esta guía es para los equipos de **los demás microservicios** de ECIExpress. Explica:

1. [Cómo deben venir los eventos](#1-contrato-del-evento-sobre) (el "sobre").
2. [Todos los eventos que recibe](#3-catálogo-de-eventos-que-consume) y qué campos necesita cada uno.
3. [Cómo hacer que se envíen notificaciones](#4-cómo-disparar-una-notificación-desde-tu-servicio) por mail, WhatsApp, SMS, push y tiempo real.
4. [Cómo personalizar el HTML del correo](#511-plantillas-html-de-correo-una-carpeta-por-microservicio) con una plantilla por evento.

> **Estado de los canales (jun 2026):** Mail y SMS ya envían a destinatarios reales.
> WhatsApp y tiempo real están en implementación; mientras tanto funcionan en modo
> sandbox (registran el envío sin entregarlo). La forma de integrar **no cambia** cuando
> queden listos: tu evento ya puede listar esos canales hoy.

> Resumen en una frase: publica un JSON **plano** en el exchange `eciexpress_events` con
> la routing key correcta y los campos que pide cada evento; el servicio de
> notificaciones resuelve el destinatario, el texto y los canales automáticamente.
> Si necesitas algo a la medida, usa el [comando genérico](#42-opción-b--comando-genérico-cualquier-cosa-por-cualquier-canal).

---

## 1. Contrato del evento (sobre)

- **Transporte:** RabbitMQ (CloudAMQP).
- **Exchange:** `eciexpress_events` — tipo `topic`, `durable: true`.
- **Routing key:** formato `<servicio>.<entidad>.<accion>` en `snake_case`
  (ej. `order.order.created`, `identity.user.registered`).
- **Cuerpo:** JSON **plano** (todos los campos al primer nivel). **No** anides los datos
  dentro de un subnodo `payload`.
- **Codificación:** `contentType: application/json`, mensajes `persistent: true`.

### Campos recomendados en TODO evento

| Campo | Tipo | Obligatorio | Para qué |
|---|---|---|---|
| `idempotencyKey` | string (uuid) | **Muy recomendado** | Evita notificaciones duplicadas si el evento se reentrega. Si no lo mandas, se deduplica con `routingKey + id de la entidad`. |
| `occurredAt` | string ISO‑8601 | opcional | Trazabilidad. |
| `source` | string | opcional | Nombre del servicio que publicó. |

Ejemplo de sobre correcto (✅) vs incorrecto (❌):

```jsonc
// ✅ CORRECTO — plano
{
  "orderId": "ord_123",
  "buyerId": "usr_456",
  "totalAmount": 4500000,
  "idempotencyKey": "f0c1...-uuid",
  "occurredAt": "2026-06-15T18:30:00Z"
}

// ❌ INCORRECTO — anidado bajo "payload"
{
  "eventType": "OrderCreated",
  "payload": { "orderId": "ord_123", "buyerId": "usr_456" }
}
```

> Los montos de dinero van en **centavos de COP** como entero (igual que financial-service):
> `4500000` = $45.000. El servicio los formatea solo en el texto.

---

## 2. Cola y bindings (ya configurados, solo informativo)

El servicio crea su propia cola `notifications_service_queue` enlazada al exchange con
estos patrones. Tu evento llega si su routing key empieza por uno de ellos:

```
identity.#   order.#   fulfillment.#   financial.#   product.#   notification.#
```

Si publicas una routing key que el servicio aún no conoce, **no pasa nada** (se ignora
silenciosamente). Solo se actúa sobre las del catálogo de abajo.

---

## 3. Catálogo de eventos que consume

Por cada evento se indican los **campos del payload** que el servicio usa (los marcados
con `*` son obligatorios para que la notificación se envíe), a **quién** se notifica y por
qué **canales**.

> Convención de destinatario: `buyerId` / `userId` = id del usuario (de Identity).
> `storeId` se traduce internamente al **dueño** de la tienda (debe haber llegado antes
> `identity.store.created` con su `ownerId`).

### 3.1 Identity

| Routing key | Campos | Notifica a | Canales | Notas |
|---|---|---|---|---|
| `identity.user.registered` | `userId*`, `email`, `fullName`, `phone` | el usuario | Mail, Tiempo real | Crea/actualiza el contacto local. Manda `email` para que llegue el correo; manda `phone` si quieres habilitar WA/SMS a futuro. |
| `identity.user.profile_updated` | `userId*`, `newValues: { email?, phone?, fullName? }` | — | — | **No notifica**, pero **actualiza el teléfono/email** guardado. Es la vía para que WA y SMS tengan a dónde enviar. |
| `identity.user.deactivated` | `userId*` | — | — | Marca el contacto inactivo. |
| `identity.store.created` | `storeId*`, `ownerId*`, `name` | el dueño | Mail, Tiempo real | Guarda el mapeo `storeId → ownerId` (necesario para notificar a la tienda en otros eventos). |
| `identity.store.updated` / `identity.store.status_changed` | `storeId*`, `name?`, `status?` | — | — | Actualiza la proyección de la tienda. |

### 3.2 Order & Communication

| Routing key | Campos | Notifica a | Canales |
|---|---|---|---|
| `order.order.created` | `orderId*`, `buyerId*`, `storeId?`, `totalAmount?` | comprador | Mail, Tiempo real, Push |
| `order.order.confirmed` | `orderId*`, `buyerId*` | comprador | Mail, **WhatsApp**, Tiempo real, Push |
| `order.order.cancelled` | `orderId*`, `buyerId*` | comprador | Mail, Tiempo real, Push |
| `order.order.status_changed` | `orderId*`, `buyerId*`, `status*` | comprador | Tiempo real, Push |
| `order.chat.message.sent` | `recipientId*`, `senderId?`, `conversationId?`, `messageId?`, `preview?` | receptor | Push, Tiempo real |

### 3.3 Fulfillment

| Routing key | Campos | Notifica a | Canales |
|---|---|---|---|
| `fulfillment.qr.generated` | `orderId*`, `buyerId*`, `qrCode?` | comprador | Mail, **WhatsApp** |
| `fulfillment.delivery.confirmed` | `orderId*`, `buyerId*` | comprador | Mail, Tiempo real, Push |
| `fulfillment.qr.expired` | `orderId*`, `buyerId*` | comprador | Mail, Tiempo real, Push |
| `fulfillment.delivery.failed` | `orderId*`, `buyerId*`, `reason?` | comprador | Mail, Tiempo real, Push |

### 3.4 Financial

| Routing key | Campos | Notifica a | Canales |
|---|---|---|---|
| `financial.wallet.topup.approved` | `userId*`, `amount*`, `topupId?` | usuario | Mail, Tiempo real, Push |
| `financial.payment.processed` | `orderId*`, `userId*`, `totalCharged?` | comprador | Tiempo real, Push |
| `financial.payment.failed` | `orderId*`, `userId*`, `reason?` | comprador | Mail, Tiempo real, Push |
| `financial.payment.released` | `orderId*`, `storeId*`, `storePayoutAmount?` | dueño de la tienda | Mail, Tiempo real |
| `financial.refund.issued` | `orderId*`, `userId*`, `refundedAmount?` | comprador | Mail, Tiempo real, Push |

> ⚠️ **Importante para Financial:** hoy estos eventos publican `walletId`/`storeId` pero
> **no** el `userId` del comprador. Sin `userId`, la notificación **se omite**. Agreguen
> `userId` al payload de `topup.approved`, `payment.processed`, `payment.failed` y
> `refund.issued`.

### 3.5 Product Management

| Routing key | Campos | Notifica a | Canales |
|---|---|---|---|
| `product.inventory.low_stock` | `productId*`, `storeId*`, `productName?`, `remainingStock?` | dueño de la tienda | Mail, Tiempo real, Push |

### Ejemplos de payload

```jsonc
// order.order.confirmed
{ "orderId": "ord_123", "buyerId": "usr_456", "idempotencyKey": "..." }

// fulfillment.qr.generated
{ "orderId": "ord_123", "buyerId": "usr_456", "qrCode": "https://.../qr/ord_123.png", "idempotencyKey": "..." }

// financial.wallet.topup.approved
{ "userId": "usr_456", "amount": 5000000, "topupId": "top_789", "idempotencyKey": "..." }

// product.inventory.low_stock
{ "productId": "prod_1", "storeId": "str_9", "productName": "Empanada", "remainingStock": 3, "idempotencyKey": "..." }
```

---

## 4. Cómo disparar una notificación desde tu servicio

Tienes dos opciones. **Casi siempre la A.**

### 4.1 Opción A — publicar el evento de negocio (recomendado)

Solo publica tu evento normal del dominio con la routing key y los campos del catálogo.
El servicio de notificaciones decide texto y canales. **No tienes que saber nada de
mail/WA/SMS/push.**

#### Con `amqplib` (como lo hace identity-service)

```ts
import * as amqplib from 'amqplib';
import { randomUUID } from 'crypto';

const EXCHANGE = 'eciexpress_events';

const conn = await amqplib.connect(process.env.RABBITMQ_URL!);
const channel = await conn.createChannel();
await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

function publish(routingKey: string, body: object) {
  const message = { ...body, idempotencyKey: randomUUID(), occurredAt: new Date().toISOString() };
  channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(message)), {
    persistent: true,
    contentType: 'application/json',
  });
}

// Ejemplo: al confirmar el pago de una orden
publish('order.order.confirmed', { orderId: 'ord_123', buyerId: 'usr_456' });
```

#### Con `@golevelup/nestjs-rabbitmq` (como financial-service)

```ts
constructor(private readonly amqp: AmqpConnection) {}

await this.amqp.publish('eciexpress_events', 'order.order.confirmed', {
  orderId: 'ord_123',
  buyerId: 'usr_456',
  idempotencyKey: randomUUID(),
});
```

### 4.2 Opción B — comando genérico (cualquier cosa por cualquier canal)

Cuando quieras enviar algo **a la medida**, eligiendo tú los canales y el texto (sin un
evento de negocio dedicado). Dos vías equivalentes:

**Vía bus** — routing key `notification.send.requested`:

```ts
publish('notification.send.requested', {
  recipientUserId: 'usr_456',          // se resuelven sus datos de contacto guardados
  channels: ['EMAIL', 'PUSH', 'REALTIME'],
  title: 'Tu cupón está por vencer',
  body: 'Usa el cupón ECI20 antes del viernes.',
  data: { deepLink: '/cupones/ECI20' },
  dedupKey: 'cupon-ECI20-usr_456',     // opcional, evita duplicados
});
```

**Vía REST** (uso interno service-to-service / pruebas) — `POST /notifications/send`:

```bash
curl -X POST http://localhost:3006/notifications/send \
  -H 'Content-Type: application/json' \
  -d '{
    "recipientUserId": "usr_456",
    "channels": ["EMAIL", "SMS"],
    "title": "Código de verificación",
    "body": "Tu código es 123456"
  }'
```

#### Campos del comando genérico

| Campo | Tipo | Notas |
|---|---|---|
| `recipientUserId` | uuid | Resuelve email/teléfono/tokens guardados del usuario. |
| `email` | string | Destino de correo explícito (tiene prioridad sobre el guardado). |
| `phone` | string | Destino de WhatsApp/SMS explícito (E.164, ej. `+57300...`). |
| `deviceTokens` | string[] | Tokens FCM explícitos para push. |
| `channels*` | `('EMAIL'\|'WHATSAPP'\|'SMS'\|'PUSH'\|'REALTIME')[]` | A qué canales enviar. |
| `title*`, `body*` | string | Contenido. |
| `type` | string | Etiqueta para clasificar (opcional). |
| `data` | objeto | Datos extra (deep-link, ids) que viajan al cliente. |
| `dedupKey` | string | Idempotencia. |

> Debes indicar **al menos un destino**: `recipientUserId` y/o destinos explícitos
> (`email`/`phone`/`deviceTokens`).

---

## 5. Qué necesita CADA canal para llegar a destino

El canal solo envía si tiene a dónde. Si no hay destino o el usuario desactivó el canal,
la entrega queda **SKIPPED** (no falla el evento). Resumen:

| Canal | Necesita | De dónde sale |
|---|---|---|
| **Mail** | un email del usuario | `email` en `identity.user.registered` (o `email` explícito en el comando genérico) |
| **WhatsApp** | un teléfono del usuario | `phone` en `identity.user.registered` o en `identity.user.profile_updated.newValues.phone` (o `phone` explícito) |
| **SMS** | un teléfono del usuario | igual que WhatsApp |
| **Push** | que el usuario haya **registrado un token** | la app llama `POST /devices` (ver abajo); o pasa `deviceTokens` explícitos |
| **Tiempo real** | que la app esté **conectada por WebSocket** | la app abre un socket (ver abajo). Aunque no esté conectada, la notificación queda en la bandeja in-app. |

### 5.1 Habilitar Mail
Llega solo: con que Identity mande `email` en el registro, los correos de bienvenida,
órdenes, pagos, etc. salen automáticamente. Para envíos reales (no sandbox) configurar
`RESEND_API_KEY` en el `.env` del servicio.

El correo se envía como **texto plano** por defecto. Si quieres un diseño bonito (HTML),
define una plantilla — ver la sección siguiente.

### 5.1.1 Plantillas HTML de correo (una carpeta por microservicio)

Cada servicio puede aportar sus propias plantillas de correo. El servicio de
notificaciones resuelve la plantilla **a partir de la routing key del evento**:

```
routing key:   financial . wallet.topup.approved
               └────────┘   └──────────────────┘
                 servicio       nombre del archivo

plantilla:     src/templates/financial/wallet.topup.approved.html
```

Es decir: **el primer segmento de la routing key es la carpeta**, y el resto (tal cual,
con sus puntos) es el nombre del archivo `.html`. Así cada equipo mantiene sus plantillas
agrupadas:

```
src/templates/
├── financial/
│   ├── wallet.topup.approved.html
│   ├── payment.failed.html
│   └── refund.issued.html
├── order/
│   └── order.confirmed.html
└── identity/
    └── user.registered.html
```

- Si **existe** el archivo para ese evento → el correo se manda en HTML con esa plantilla.
- Si **no existe** → cae automáticamente a texto plano. No falla nada.
- Las plantillas viven en `src/templates/` y se copian a `dist/` en el build
  (configurado en `nest-cli.json`); no hay que hacer nada extra al desplegar.

#### Variables disponibles en la plantilla

Se reemplazan los marcadores `{{variable}}` con estos valores:

| Variable | Contenido |
|---|---|
| `{{title}}` | El título de la notificación. |
| `{{body}}` | El texto del cuerpo (el mismo del texto plano). |
| `{{recipientName}}` | Nombre del destinatario, **con un espacio inicial** (pensado para `Hola{{recipientName}},` → `Hola Juan,`). Vacío si no se conoce. |
| `{{year}}` | Año actual (útil para el pie de página). |
| `{{amountFormatted}}` | Si el evento trae `amount` (centavos), su versión formateada en COP (ej. `$50.000`). |
| `{{cualquierCampoDeData}}` | **Todos** los campos del `data` de la notificación. Ej.: el catálogo de `topup.approved` pone `data: { topupId, amount }`, así que tienes `{{topupId}}` y `{{amount}}`. |

> ¿Qué campos hay en `data`? Los que el catálogo (sección 3) define en la columna `data`
> de cada evento. Si usas el [comando genérico](#42-opción-b--comando-genérico-cualquier-cosa-por-cualquier-canal),
> son las claves que mandes en tu objeto `data`.

#### Ejemplo mínimo de plantilla

`src/templates/order/order.confirmed.html`:

```html
<!DOCTYPE html>
<html lang="es">
  <body style="font-family: Arial, sans-serif;">
    <h2>{{title}}</h2>
    <p>Hola{{recipientName}},</p>
    <p>{{body}}</p>
    <p>Tu pedido <strong>{{orderId}}</strong> ya está en preparación.</p>
    <hr />
    <small>&copy; {{year}} ECIExpress</small>
  </body>
</html>
```

#### Cómo aportar tu plantilla

Como las plantillas viven dentro de este repositorio, mándalas por PR a
`notifications-service` (carpeta `src/templates/<tu-servicio>/`). Asegúrate de que el
nombre del archivo coincida **exactamente** con la routing key (sin el primer segmento)
más `.html`.

### 5.2 Habilitar WhatsApp / SMS
Estos canales necesitan **teléfono**. Hoy Identity **no** envía teléfono en el registro,
así que para que WA/SMS lleguen, manda el teléfono en el perfil:

```ts
publish('identity.user.profile_updated', {
  userId: 'usr_456',
  newValues: { phone: '+573001234567' },
});
```

Para envíos reales configurar las credenciales de Twilio (SMS) y/o WhatsApp Cloud API en
el `.env`. Sin credenciales, el canal funciona en **sandbox** (loguea el mensaje).

### 5.3 Habilitar Push (FCM)
La app (web/móvil) debe registrar su token de dispositivo. Una vez registrado, cualquier
notificación con canal `PUSH` dirigida a ese usuario le llega a todos sus dispositivos.

```bash
# La app, tras obtener el token de FCM:
curl -X POST http://localhost:3006/devices \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: usr_456' \
  -d '{ "token": "fcm_token_abc...", "platform": "ANDROID" }'   # ANDROID | IOS | WEB

# Al cerrar sesión:
curl -X DELETE http://localhost:3006/devices/fcm_token_abc... -H 'x-user-id: usr_456'
```

Para envíos reales configurar `FCM_SERVER_KEY` en el `.env`.

### 5.4 Habilitar Tiempo real (in-app / WebSocket)
La app abre una conexión Socket.IO pasando el id del usuario en el handshake y escucha el
evento `notification`:

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3006', {
  query: { userId: 'usr_456' },          // o header x-user-id vía el gateway
});

socket.on('notification', (n) => {
  // n = { title, body, data }
  mostrarToast(n.title, n.body);
});
```

La notificación **siempre** queda persistida; la app la lista con
`GET /notifications` (header `x-user-id`) aunque el usuario estuviera desconectado.

---

## 6. Preferencias e idempotencia (bueno saberlo)

- **Preferencias:** cada usuario puede desactivar canales (`GET/PATCH /preferences`). Si
  un canal está desactivado para ese usuario, su entrega queda `SKIPPED`. Por defecto
  todos los canales están activos.
- **Idempotencia:** manda `idempotencyKey` en cada evento. Si el mismo evento llega dos
  veces (reentrega del bus), la notificación **no se duplica**. Si no lo mandas, se usa
  `routingKey + id de la entidad` como clave; aun así, mandar `idempotencyKey` es lo
  más seguro.

---

## 7. Checklist rápido para tu servicio

- [ ] Publico en el exchange `eciexpress_events` (topic, durable).
- [ ] Mi routing key sigue `servicio.entidad.accion` en snake_case.
- [ ] El JSON va **plano**, sin subnodo `payload`.
- [ ] Incluyo los campos obligatorios del catálogo (sobre todo el id del destinatario:
      `buyerId`/`userId`/`storeId`+`ownerId`).
- [ ] Incluyo `idempotencyKey`.
- [ ] Montos en centavos de COP.
- [ ] (Financial) incluyo `userId` del comprador en los eventos de pago/recarga/reembolso.
```
