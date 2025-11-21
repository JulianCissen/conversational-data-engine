import { Module } from '@nestjs/common';
import { IntentService } from './intent.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [IntentService],
  exports: [IntentService],
})
export class IntentModule {}
