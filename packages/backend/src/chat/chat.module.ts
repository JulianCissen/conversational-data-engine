import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { Session } from '../session/session.entity';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { ExtractionModule } from '../extraction/extraction.module';
import { GenerationModule } from '../generation/generation.module';
import { IntentModule } from '../intent/intent.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([Session]),
    OrchestratorModule,
    ExtractionModule,
    GenerationModule,
    IntentModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
