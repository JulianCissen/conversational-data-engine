import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { ConversationFlowService } from './conversation.flow.service';
import { ArrayCollectionService } from './array-collection.service';
import { Conversation } from './conversation.entity';
import { WorkflowModule } from '../workflow/workflow.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { BlueprintModule } from '../blueprint/blueprint.module';
import { PluginModule } from '../../core/plugin/plugin.module';
import { ValidationModule } from '../../core/validation/validation.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([Conversation]),
    WorkflowModule,
    IntelligenceModule,
    BlueprintModule,
    PluginModule,
    ValidationModule,
  ],
  controllers: [ConversationController],
  providers: [
    ConversationService,
    ConversationFlowService,
    ArrayCollectionService,
  ],
  exports: [
    ConversationService,
    ConversationFlowService,
    ArrayCollectionService,
  ],
})
export class ConversationModule {}
