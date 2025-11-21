import { Module } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { GenerationController } from './generation.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [GenerationController],
  providers: [GenerationService],
  exports: [GenerationService],
})
export class GenerationModule {}
