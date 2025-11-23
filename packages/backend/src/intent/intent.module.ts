import { Module } from '@nestjs/common';
import { IntentService } from './intent.service';
import { AiModule } from '../ai/ai.module';
import { ConfigModule } from '../config/config.module';
import { TemplateModule } from '../template/template.module';

@Module({
  imports: [AiModule, ConfigModule, TemplateModule],
  providers: [IntentService],
  exports: [IntentService],
})
export class IntentModule {}
