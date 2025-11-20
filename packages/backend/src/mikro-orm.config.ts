import { defineConfig } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';

export default defineConfig({
  dbName: 'form_engine',
  user: 'admin',
  password: 'password123',
  host: 'localhost', // Use 'postgres' if running backend in docker too
  port: 5432,
  entities: ['dist/**/*.entity.js'], // Compiled entities
  entitiesTs: ['src/**/*.entity.ts'], // Source entities (for CLI)
  metadataProvider: TsMorphMetadataProvider,
  debug: true, // Nice for development to see SQL queries in console
});
