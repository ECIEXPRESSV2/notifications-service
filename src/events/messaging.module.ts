import {
  Global,
  Inject,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServiceBusClient } from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';

/**
 * Token de inyección del cliente de Azure Service Bus compartido.
 * Lo usan el suscriptor (receiver) y, en servicios que publican, el sender.
 */
export const SERVICE_BUS_CLIENT = Symbol('SERVICE_BUS_CLIENT');

/**
 * Módulo global del bus de eventos (Azure Service Bus).
 *
 * Crea un único `ServiceBusClient` autenticado con Managed Identity
 * (DefaultAzureCredential) contra el FQDN del namespace. Se marca @Global para que el
 * cliente esté disponible en todo el árbol sin reimportar. La conexión se cierra al
 * apagar la app. Este servicio es consumidor final: no publica eventos de negocio.
 *
 * Reemplaza al antiguo RabbitMQModule (@golevelup/amqplib).
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SERVICE_BUS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ServiceBusClient => {
        const connStr = process.env.SERVICE_BUS_CONNECTION_STRING;
        if (connStr) return new ServiceBusClient(connStr);
        const fqns = config.getOrThrow<string>(
          'serviceBus.fullyQualifiedNamespace',
        );
        return new ServiceBusClient(fqns, new DefaultAzureCredential());
      },
    },
  ],
  exports: [SERVICE_BUS_CLIENT],
})
export class MessagingModule implements OnApplicationShutdown {
  constructor(
    @Inject(SERVICE_BUS_CLIENT) private readonly client: ServiceBusClient,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
