import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { Conversation } from './conversation.entity';
import { WorkflowModule } from '../workflow/workflow.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { BlueprintModule } from '../blueprint/blueprint.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([Conversation]),
    WorkflowModule,
    IntelligenceModule,
    BlueprintModule,
  ],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
