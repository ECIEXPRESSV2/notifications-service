import { registerAs } from '@nestjs/config';

/**
 * Configuración general de la aplicación.
 *
 * `frontendUrl` es la URL base del front de ECIExpress; las plantillas de correo la
 * usan para construir enlaces (ej. "Ver mi billetera"). Llega por la variable de entorno
 * FRONTEND_URL; en desarrollo apunta al Vite local. Al desplegar, basta con cambiar la
 * variable de entorno (sin tocar plantillas ni código).
 */
export const appConfig = registerAs('app', () => ({
  frontendUrl: (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(
    /\/$/,
    '',
  ),
}));
