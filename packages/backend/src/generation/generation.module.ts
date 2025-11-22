import { Module } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { GenerationController } from './generation.controller';
import { AiModule } from '../ai/ai.module';
import { ConfigModule } from '../config/config.module';
import { TemplateModule } from '../template/template.module';

@Module({
  imports: [AiModule, ConfigModule, TemplateModule],
  controllers: [GenerationController],
  providers: [GenerationService],
  exports: [GenerationService],
})
export class GenerationModule {}
