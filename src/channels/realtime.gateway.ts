import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Gateway de notificaciones en tiempo real (in-app) sobre Socket.IO.
 *
 * El cliente (app web/móvil) se conecta enviando su id de usuario en el handshake,
 * ya sea como query `?userId=...` o como header `x-user-id` (inyectado por el gateway).
 * Cada usuario entra a una sala con su propio id; las notificaciones se emiten a esa
 * sala para que lleguen a todas las pestañas/dispositivos conectados del usuario.
 *
 * El evento emitido es `notification` con el cuerpo de la notificación.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket): void {
    const userId = this.extractUserId(client);
    if (!userId) {
      this.logger.warn('Conexión WS sin userId; se desconecta');
      client.disconnect(true);
      return;
    }
    void client.join(this.room(userId));
    this.logger.log(`Cliente WS conectado: userId=${userId}`);
  }

  handleDisconnect(client: Socket): void {
    const userId = this.extractUserId(client);
    this.logger.log(
      `Cliente WS desconectado: userId=${userId ?? 'desconocido'}`,
    );
  }

  /** Emite una notificación a todas las conexiones activas de un usuario. */
  emitToUser(userId: string, payload: Record<string, unknown>): boolean {
    if (!this.server) {
      return false;
    }
    this.server.to(this.room(userId)).emit('notification', payload);
    return true;
  }

  /** True si el usuario tiene al menos una conexión activa (está "online"). */
  isUserOnline(userId: string): boolean {
    const room = this.server?.sockets?.adapter?.rooms?.get(this.room(userId));
    return !!room && room.size > 0;
  }

  private room(userId: string): string {
    return `user:${userId}`;
  }

  private extractUserId(client: Socket): string | undefined {
    const fromQuery = client.handshake.query?.userId;
    if (typeof fromQuery === 'string' && fromQuery) {
      return fromQuery;
    }
    const fromHeader = client.handshake.headers['x-user-id'];
    if (typeof fromHeader === 'string' && fromHeader) {
      return fromHeader;
    }
    return undefined;
  }
}
