import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Elimina todo lo relacionado con notificaciones push (FCM):
 *  - Tabla device_tokens y su enum
 *  - Columna push_enabled de notification_preferences
 *  - Valor 'PUSH' del enum notification_deliveries_channel_enum
 *
 * WhatsApp (Meta Cloud API) reemplaza push en todos los flujos de notificación urgente.
 */
export class RemovePush1750000000000 implements MigrationInterface {
  name = 'RemovePush1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Eliminar tabla de tokens de dispositivo FCM
    await queryRunner.query(`DROP TABLE IF EXISTS "device_tokens"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "device_tokens_platform_enum"`,
    );

    // 2. Quitar columna push_enabled de preferencias
    await queryRunner.query(
      `ALTER TABLE "notification_preferences" DROP COLUMN IF EXISTS "push_enabled"`,
    );

    // 3. Quitar 'PUSH' del enum de canales de entrega.
    //    PostgreSQL no permite DROP VALUE en un enum, así que se reemplaza el tipo
    //    creando uno nuevo sin 'PUSH', cambiando la columna y eliminando el viejo.
    await queryRunner.query(
      `ALTER TYPE "notification_deliveries_channel_enum" RENAME TO "notification_deliveries_channel_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "notification_deliveries_channel_enum" AS ENUM ('EMAIL','WHATSAPP','SMS','REALTIME')`,
    );
    await queryRunner.query(`
      ALTER TABLE "notification_deliveries"
        ALTER COLUMN "channel" TYPE "notification_deliveries_channel_enum"
        USING (
          CASE "channel"::text
            WHEN 'PUSH' THEN NULL
            ELSE "channel"::text::"notification_deliveries_channel_enum"
          END
        )
    `);
    // Eliminar registros huérfanos de entregas por PUSH (canal ya no existe)
    await queryRunner.query(
      `DELETE FROM "notification_deliveries" WHERE "channel" IS NULL`,
    );
    await queryRunner.query(
      `DROP TYPE "notification_deliveries_channel_enum_old"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restaurar enum con PUSH
    await queryRunner.query(
      `ALTER TYPE "notification_deliveries_channel_enum" RENAME TO "notification_deliveries_channel_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "notification_deliveries_channel_enum" AS ENUM ('EMAIL','WHATSAPP','SMS','PUSH','REALTIME')`,
    );
    await queryRunner.query(`
      ALTER TABLE "notification_deliveries"
        ALTER COLUMN "channel" TYPE "notification_deliveries_channel_enum"
        USING "channel"::text::"notification_deliveries_channel_enum"
    `);
    await queryRunner.query(
      `DROP TYPE "notification_deliveries_channel_enum_old"`,
    );

    // Restaurar columna push_enabled
    await queryRunner.query(
      `ALTER TABLE "notification_preferences" ADD COLUMN "push_enabled" boolean NOT NULL DEFAULT true`,
    );

    // Restaurar tabla device_tokens
    await queryRunner.query(
      `CREATE TYPE "device_tokens_platform_enum" AS ENUM ('ANDROID','IOS','WEB')`,
    );
    await queryRunner.query(`
      CREATE TABLE "device_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "token" character varying NOT NULL,
        "platform" "device_tokens_platform_enum" NOT NULL DEFAULT 'ANDROID',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_device_tokens" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_device_tokens_token" ON "device_tokens" ("token")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_device_tokens_user_id" ON "device_tokens" ("user_id")`,
    );
  }
}
