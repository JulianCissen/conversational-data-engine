import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import config from './mikro-orm.config';
import { AiModule } from './ai/ai.module';
import { ConfigModule } from './config/config.module';
import { TemplateModule } from './template/template.module';
import { ExtractionModule } from './extraction/extraction.module';
import { GenerationModule } from './generation/generation.module';
import { ChatModule } from './chat/chat.module';
import { BlueprintModule } from './blueprint/blueprint.module';

@Module({
  imports: [
    NestConfigModule.forRoot({ isGlobal: true }),
    MikroOrmModule.forRoot(config),
    ConfigModule,
    TemplateModule,
    AiModule,
    BlueprintModule,
    ExtractionModule,
    GenerationModule,
    ChatModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
