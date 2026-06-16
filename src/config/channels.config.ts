import { registerAs } from '@nestjs/config';

/**
 * Credenciales y endpoints de los proveedores externos de cada canal de notificación.
 *
 * NINGUNA credencial se escribe en el código fuente: todas llegan por variables de
 * entorno. Cuando las credenciales de un canal están vacías, el proveedor entra en
 * modo "sandbox" y solo loguea el mensaje en consola en vez de enviarlo (mismo
 * principio que el PayoutService del financial-service). Así el servicio funciona de
 * extremo a extremo en desarrollo sin cuentas reales en Resend/Twilio/Meta/FCM.
 */
export const channelsConfig = registerAs('channels', () => ({
  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    from: process.env.MAIL_FROM ?? 'ECIExpress <no-reply@eciexpress.edu.co>',
  },
  whatsapp: {
    // 'cloud' = Meta WhatsApp Cloud API (oficial); 'openwa' = servidor OpenWA
    // (@open-wa/wa-automate) que expone WhatsApp Web por REST, gratis y sin Meta.
    provider: (process.env.WHATSAPP_PROVIDER ?? 'cloud') as 'cloud' | 'openwa',
    apiUrl: process.env.WHATSAPP_API_URL ?? 'https://graph.facebook.com/v21.0',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    token: process.env.WHATSAPP_TOKEN,
    // OpenWA: api_key opcional con el que se levantó el servidor (--api-key).
    apiKey: process.env.WHATSAPP_OPENWA_API_KEY,
  },
  sms: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM,
  },
  push: {
    fcmServerKey: process.env.FCM_SERVER_KEY,
  },
}));
