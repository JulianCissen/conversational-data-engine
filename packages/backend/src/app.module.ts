import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import config from './mikro-orm.config';
import { AiModule } from './ai/ai.module';
import { ExtractionModule } from './extraction/extraction.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MikroOrmModule.forRoot(config),
    AiModule,
    ExtractionModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
