import { defineConfig } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { Prompt } from './config/prompt.entity';
import { Session } from './session/session.entity';

export default defineConfig({
  dbName: 'form_engine',
  user: 'admin',
  password: 'password123',
  host: 'localhost', // Use 'postgres' if running backend in docker too
  port: 5432,
  entities: [Session, Prompt], // Explicitly list entities
  entitiesTs: ['src/**/*.entity.ts'], // Source entities (for CLI)
  metadataProvider: TsMorphMetadataProvider,
  debug: true, // Nice for development to see SQL queries in console
});
