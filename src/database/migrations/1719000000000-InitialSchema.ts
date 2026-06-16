import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración inicial del notifications-service: crea las 6 tablas, sus enums e índices.
 *
 * Tablas:
 *  - recipients              proyección de contacto de usuarios (email/teléfono)
 *  - notification_stores     proyección de tiendas (para resolver al dueño)
 *  - device_tokens           tokens FCM para push
 *  - notification_preferences preferencias de canal por usuario
 *  - notifications           notificación lógica + bandeja in-app
 *  - notification_deliveries  intento de entrega por canal
 *
 * Se usa gen_random_uuid() (núcleo de PostgreSQL 13+) para las PK autogeneradas.
 */
export class InitialSchema1719000000000 implements MigrationInterface {
  name = 'InitialSchema1719000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Enums ---
    await queryRunner.query(
      `CREATE TYPE "device_tokens_platform_enum" AS ENUM ('ANDROID','IOS','WEB')`,
    );
    await queryRunner.query(
      `CREATE TYPE "notification_deliveries_channel_enum" AS ENUM ('EMAIL','WHATSAPP','SMS','PUSH','REALTIME')`,
    );
    await queryRunner.query(
      `CREATE TYPE "notification_deliveries_status_enum" AS ENUM ('PENDING','SENT','FAILED','SKIPPED')`,
    );

    // --- recipients ---
    await queryRunner.query(`
      CREATE TABLE "recipients" (
        "id" uuid NOT NULL,
        "email" character varying,
        "phone" character varying,
        "full_name" character varying,
        "locale" character varying NOT NULL DEFAULT 'es',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recipients" PRIMARY KEY ("id")
      )
    `);

    // --- notification_stores ---
    await queryRunner.query(`
      CREATE TABLE "notification_stores" (
        "id" uuid NOT NULL,
        "name" character varying,
        "owner_user_id" uuid,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_stores" PRIMARY KEY ("id")
      )
    `);

    // --- device_tokens ---
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

    // --- notification_preferences ---
    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "email_enabled" boolean NOT NULL DEFAULT true,
        "whatsapp_enabled" boolean NOT NULL DEFAULT true,
        "sms_enabled" boolean NOT NULL DEFAULT true,
        "push_enabled" boolean NOT NULL DEFAULT true,
        "realtime_enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_preferences_user_id" UNIQUE ("user_id")
      )
    `);

    // --- notifications ---
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "recipient_user_id" uuid,
        "type" character varying NOT NULL,
        "source_event" character varying,
        "source_service" character varying,
        "title" character varying NOT NULL,
        "body" text NOT NULL,
        "data" jsonb,
        "dedup_key" character varying,
        "read_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_notifications_dedup_key" ON "notifications" ("dedup_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_recipient" ON "notifications" ("recipient_user_id")`,
    );

    // --- notification_deliveries ---
    await queryRunner.query(`
      CREATE TABLE "notification_deliveries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "notification_id" uuid NOT NULL,
        "channel" "notification_deliveries_channel_enum" NOT NULL,
        "status" "notification_deliveries_status_enum" NOT NULL DEFAULT 'PENDING',
        "provider" character varying,
        "provider_message_id" character varying,
        "destination" character varying,
        "error" text,
        "attempts" integer NOT NULL DEFAULT 0,
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_deliveries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notification_deliveries_notification" FOREIGN KEY ("notification_id")
          REFERENCES "notifications" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_notification_deliveries_notification_id" ON "notification_deliveries" ("notification_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_deliveries"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
    await queryRunner.query(`DROP TABLE "device_tokens"`);
    await queryRunner.query(`DROP TABLE "notification_stores"`);
    await queryRunner.query(`DROP TABLE "recipients"`);

    await queryRunner.query(`DROP TYPE "notification_deliveries_status_enum"`);
    await queryRunner.query(`DROP TYPE "notification_deliveries_channel_enum"`);
    await queryRunner.query(`DROP TYPE "device_tokens_platform_enum"`);
  }
}
