import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMessageIndexes1738668000000 implements MigrationInterface {
  name = 'AddMessageIndexes1738668000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Композитный индекс для подсчета непрочитанных сообщений
    // Этот индекс критичен для оптимизации запросов COUNT с фильтрацией по chat_id, is_from_admin, is_read
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_messages_chat_admin_read" 
      ON "messages" ("chat_id", "is_from_admin", "is_read")
    `);
    
    // Индивидуальный индекс для фильтрации по отправителю
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_messages_is_from_admin" 
      ON "messages" ("is_from_admin")
    `);
    
    // Индивидуальный индекс для фильтрации по статусу прочтения
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_messages_is_read" 
      ON "messages" ("is_read")
    `);
    
    // Индекс для быстрой сортировки чатов по времени последнего сообщения
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_chats_last_message_at" 
      ON "chats" ("last_message_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаление индексов в обратном порядке
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chats_last_message_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_is_read"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_is_from_admin"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_chat_admin_read"`);
  }
}
