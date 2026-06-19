import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface ServiceCheck {
  name: string;
  url: string;
  status: 'UP' | 'DOWN' | 'TIMEOUT';
  responseTimeMs: number;
}

const SERVICE_MAP: Record<string, string> = {
  'notifications-service': 'SERVICE_NOTIFICATIONS_URL',
  'identity-service': 'SERVICE_IDENTITY_URL',
  'financial-service': 'SERVICE_FINANCIAL_URL',
  'orders-service': 'SERVICE_ORDERS_URL',
  'products-service': 'SERVICE_PRODUCTS_URL',
  'fulfillment-service': 'SERVICE_FULFILLMENT_URL',
  'reporting-service': 'SERVICE_REPORTING_URL',
};

@Injectable()
export class WakeupService {
  private readonly logger = new Logger(WakeupService.name);
  private readonly HEALTH_TIMEOUT_MS = 50_000;

  constructor(private readonly config: ConfigService) {}

  async pingAndNotify(): Promise<void> {
    const services = this.resolveServices();

    if (!services.length) {
      this.logger.warn('No hay URLs de servicio configuradas (SERVICE_*_URL).');
      return;
    }

    this.logger.log(`Iniciando wakeup de ${services.length} microservicio(s)...`);
    const results = await Promise.all(services.map((s) => this.checkService(s)));

    const upCount = results.filter((r) => r.status === 'UP').length;
    this.logger.log(`Wakeup completado: ${upCount}/${results.length} servicios respondieron.`);

    await this.sendReport(results);
  }

  private resolveServices(): { name: string; url: string }[] {
    return Object.entries(SERVICE_MAP)
      .map(([name, envKey]) => ({ name, url: process.env[envKey]?.replace(/\/$/, '') ?? '' }))
      .filter((s) => Boolean(s.url));
  }

  private async checkService(service: { name: string; url: string }): Promise<ServiceCheck> {
    const start = Date.now();
    try {
      await axios.get(`${service.url}/health`, { timeout: this.HEALTH_TIMEOUT_MS });
      return { ...service, status: 'UP', responseTimeMs: Date.now() - start };
    } catch (err) {
      const isTimeout =
        axios.isAxiosError(err) &&
        (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT');
      return {
        ...service,
        status: isTimeout ? 'TIMEOUT' : 'DOWN',
        responseTimeMs: Date.now() - start,
      };
    }
  }

  private async sendReport(results: ServiceCheck[]): Promise<void> {
    const apiKey = this.config.get<string>('channels.email.brevoApiKey');
    const from = this.config.get<string>('channels.email.from')!;
    const to = this.config.get<string>('app.wakeupEmail');

    if (!to) {
      this.logger.warn('WAKEUP_REPORT_EMAIL no configurado. Se omite el envío del reporte.');
      return;
    }

    const upCount = results.filter((r) => r.status === 'UP').length;
    const subject = `[ECIExpress] Wakeup Report — ${upCount}/${results.length} servicios activos`;
    const html = this.buildHtml(results);

    if (!apiKey) {
      this.logger.log(
        `[SANDBOX EMAIL] Para: ${to} | Asunto: ${subject}\n` +
          results.map((r) => `  ${r.name}: ${r.status}`).join('\n'),
      );
      return;
    }

    try {
      const sender = this.parseSender(from);
      await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        { sender, to: [{ email: to }], subject, htmlContent: html },
        { headers: { 'api-key': apiKey, 'Content-Type': 'application/json' }, timeout: 10_000 },
      );
      this.logger.log(`Reporte de wakeup enviado a ${to}.`);
    } catch (err) {
      this.logger.error(`Error al enviar el reporte de wakeup: ${err}`);
    }
  }

  private parseSender(from: string): { name: string; email: string } {
    const match = from.match(/^(.+?)\s*<(.+?)>$/);
    if (match) return { name: match[1].trim(), email: match[2].trim() };
    return { name: 'ECIExpress', email: from.trim() };
  }

  private buildHtml(results: ServiceCheck[]): string {
    const upCount = results.filter((r) => r.status === 'UP').length;
    const downCount = results.length - upCount;
    const timestamp = new Date().toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'long',
      timeStyle: 'medium',
    });

    const serviceRows = results
      .map((r) => {
        const isUp = r.status === 'UP';
        const dotColor = isUp ? '#22c55e' : '#ef4444';
        const statusLabel = isUp ? 'En línea' : r.status === 'TIMEOUT' ? 'Sin respuesta' : 'Caído';
        const timeLabel = isUp
          ? `${r.responseTimeMs.toLocaleString('es-CO')} ms`
          : '—';

        return `
        <tr>
          <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b;font-weight:500;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};margin-right:10px;vertical-align:middle;"></span>
            ${r.name}
          </td>
          <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;text-align:center;">
            <span style="
              display:inline-block;
              padding:4px 12px;
              border-radius:20px;
              font-size:12px;
              font-weight:600;
              letter-spacing:0.5px;
              background:${isUp ? '#dcfce7' : '#fee2e2'};
              color:${isUp ? '#15803d' : '#b91c1c'};
            ">
              ${isUp ? '✅' : '❌'}&nbsp;&nbsp;${statusLabel}
            </span>
          </td>
          <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:13px;color:${isUp ? '#64748b' : '#94a3b8'};">
            ${timeLabel}
          </td>
        </tr>`;
      })
      .join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wakeup Report — ECIExpress</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="
              background:linear-gradient(135deg,#1e3a5f 0%,#0f2d4a 60%,#0a1f35 100%);
              border-radius:16px 16px 0 0;
              padding:40px 40px 36px;
              text-align:center;
            ">
              <div style="
                display:inline-block;
                background:rgba(255,255,255,0.1);
                border:1px solid rgba(255,255,255,0.2);
                border-radius:12px;
                padding:8px 20px;
                margin-bottom:20px;
              ">
                <span style="color:#93c5fd;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
                  Sistema de Infraestructura
                </span>
              </div>
              <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
                Wakeup Report
              </h1>
              <p style="margin:0;color:#94a3b8;font-size:14px;">
                ECIExpress Microservices — Render Deployment
              </p>
            </td>
          </tr>

          <!-- SUMMARY CARDS -->
          <tr>
            <td style="background:#ffffff;padding:32px 40px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48%" style="
                    background:#f0fdf4;
                    border:1px solid #bbf7d0;
                    border-radius:12px;
                    padding:20px 24px;
                    text-align:center;
                  ">
                    <div style="font-size:36px;font-weight:800;color:#15803d;line-height:1;">${upCount}</div>
                    <div style="font-size:12px;font-weight:600;color:#166534;margin-top:6px;text-transform:uppercase;letter-spacing:1px;">Activos</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="
                    background:${downCount > 0 ? '#fef2f2' : '#f8fafc'};
                    border:1px solid ${downCount > 0 ? '#fecaca' : '#e2e8f0'};
                    border-radius:12px;
                    padding:20px 24px;
                    text-align:center;
                  ">
                    <div style="font-size:36px;font-weight:800;color:${downCount > 0 ? '#b91c1c' : '#94a3b8'};line-height:1;">${downCount}</div>
                    <div style="font-size:12px;font-weight:600;color:${downCount > 0 ? '#991b1b' : '#94a3b8'};margin-top:6px;text-transform:uppercase;letter-spacing:1px;">Con fallas</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- DIVIDER -->
          <tr>
            <td style="background:#ffffff;padding:0 40px 8px;">
              <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;border-top:1px solid #f1f5f9;padding-top:20px;">
                Estado de los servicios
              </div>
            </td>
          </tr>

          <!-- TABLE -->
          <tr>
            <td style="background:#ffffff;padding:0 40px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="padding:12px 20px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #e2e8f0;">
                      Servicio
                    </th>
                    <th style="padding:12px 20px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #e2e8f0;">
                      Estado
                    </th>
                    <th style="padding:12px 20px;text-align:right;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #e2e8f0;">
                      Tiempo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${serviceRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- NOTE -->
          <tr>
            <td style="background:#ffffff;padding:8px 40px 32px;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                ⏱ Los tiempos de respuesta reflejan el arranque en frío desde Render Free Tier.
                Un tiempo elevado es normal si el servicio estaba inactivo.
              </p>
            </td>
          </tr>

          <!-- TIMESTAMP BANNER -->
          <tr>
            <td style="
              background:#1e293b;
              padding:20px 40px;
              text-align:center;
            ">
              <p style="margin:0;font-size:12px;color:#64748b;">
                Reporte generado el&nbsp;<strong style="color:#94a3b8;">${timestamp}</strong>
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="
              background:#0f172a;
              border-radius:0 0 16px 16px;
              padding:24px 40px;
              text-align:center;
            ">
              <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#3b82f6;letter-spacing:0.5px;">
                ECIExpress
              </p>
              <p style="margin:0;font-size:11px;color:#475569;">
                Plataforma de notificaciones &mdash; Generado automáticamente &mdash; No responder este correo
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
  }
}
