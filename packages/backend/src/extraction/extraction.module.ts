import { Module } from '@nestjs/common';
import { ExtractionController } from './extraction.controller';
import { ExtractionService } from './extraction.service';
import { AiModule } from '../ai/ai.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [AiModule, ConfigModule],
  controllers: [ExtractionController],
  providers: [ExtractionService],
  exports: [ExtractionService],
})
export class ExtractionModule {}
