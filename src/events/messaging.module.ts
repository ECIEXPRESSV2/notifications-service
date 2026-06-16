import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { EXCHANGE_NAME } from '../config/rabbitmq.config';

/**
 * Módulo global del bus de eventos. Configura la conexión a RabbitMQ (CloudAMQP) y
 * declara el exchange topic compartido `eciexpress_events`.
 *
 * Se marca @Global para que `AmqpConnection` (usada por los @RabbitSubscribe del
 * consumidor) esté disponible sin reimportar RabbitMQModule. La URL de conexión llega
 * por `RABBITMQ_URL`. Este servicio es consumidor final: no publica eventos de negocio.
 */
@Global()
@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('RABBITMQ_URL'),
        exchanges: [
          {
            name: EXCHANGE_NAME,
            type: 'topic',
            createExchangeIfNotExists: true,
            options: { durable: true },
          },
        ],
        // No bloquea el arranque si CloudAMQP no responde de inmediato; el
        // connection-manager reintenta y reasienta la cola/bindings al reconectar.
        connectionInitOptions: { wait: false },
      }),
    }),
  ],
  exports: [RabbitMQModule],
})
export class MessagingModule {}
