import { defineConfig } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { ConfigService } from '@nestjs/config';
import { Prompt } from './core/prompt/prompt.entity';
import { Conversation } from './modules/conversation/conversation.entity';
import { loadAndValidateDbConfig } from './core/database/db.config';

// Load database configuration from environment variables
const configService = new ConfigService();
const dbConfig = loadAndValidateDbConfig(configService);

export default defineConfig({
  dbName: dbConfig.dbName,
  user: dbConfig.user,
  password: dbConfig.password,
  host: dbConfig.host,
  port: dbConfig.port,
  entities: [Conversation, Prompt], // Explicitly list entities
  entitiesTs: ['src/**/*.entity.ts'], // Source entities (for CLI)
  metadataProvider: TsMorphMetadataProvider,
  debug: true, // Nice for development to see SQL queries in console
});
