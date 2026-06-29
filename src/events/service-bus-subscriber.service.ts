import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ServiceBusClient,
  ServiceBusReceiver,
  ServiceBusReceivedMessage,
  ProcessErrorArgs,
} from '@azure/service-bus';
import { SERVICE_BUS_CLIENT } from './messaging.module';
import { EventConsumerService } from './event-consumer.service';

/**
 * Suscriptor del topic compartido `eciexpress_events`. Reemplaza al @RabbitSubscribe:
 * abre un receiver sobre la subscription propia (`notifications-service`) y, por cada
 * mensaje, delega en EventConsumerService.handleEvent(routingKey, body).
 *
 * El `routingKey` de RabbitMQ viaja como el Subject del mensaje de Service Bus (el
 * publisher lo pone ahí; se conserva también en applicationProperties.routingKey como
 * respaldo). El filtrado fino por routing-key lo hace el consumidor en código; la
 * subscription ya trae un filtro SQL por dominio (definido en Terraform).
 *
 * autoCompleteMessages (default true): si processMessage retorna sin lanzar, el mensaje
 * se completa (ack). EventConsumerService captura los errores de DATOS internamente y
 * retorna normal (idempotente) → se completa. Si lanzara (error de infra), se abandona y
 * reintenta; tras maxDeliveryCount va a la dead-letter.
 */
@Injectable()
export class ServiceBusSubscriberService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ServiceBusSubscriberService.name);
  private receiver?: ServiceBusReceiver;

  constructor(
    @Inject(SERVICE_BUS_CLIENT) private readonly client: ServiceBusClient,
    private readonly config: ConfigService,
    private readonly consumer: EventConsumerService,
  ) {}

  onModuleInit(): void {
    const topic = this.config.getOrThrow<string>('serviceBus.topic');
    const subscription = this.config.getOrThrow<string>(
      'serviceBus.subscription',
    );

    this.receiver = this.client.createReceiver(topic, subscription);

    this.receiver.subscribe(
      {
        processMessage: async (msg: ServiceBusReceivedMessage) => {
          const routingKey = (
            msg.subject ??
            (msg.applicationProperties?.routingKey as string | undefined) ??
            ''
          ).toString();
          const body = (msg.body ?? {}) as Record<string, any>;
          await this.consumer.handleEvent(routingKey, body);
        },
        processError: async (args: ProcessErrorArgs) => {
          this.logger.error(
            `Error en el receiver de Service Bus (${args.entityPath}): ${args.error.message}`,
          );
        },
      },
      { maxConcurrentCalls: 5 },
    );

    this.logger.log(
      `Suscrito a Service Bus topic="${topic}" subscription="${subscription}"`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.receiver?.close();
  }
}
