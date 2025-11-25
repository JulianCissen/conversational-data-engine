import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import config from './mikro-orm.config';
import { LlmModule } from './core/llm/llm.module';
import { PromptModule } from './core/prompt/prompt.module';
import { TemplateModule } from './core/template/template.module';
import { PluginModule } from './core/plugin/plugin.module';
import { BlueprintModule } from './modules/blueprint/blueprint.module';
import { IntelligenceModule } from './modules/intelligence/intelligence.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { ConversationModule } from './modules/conversation/conversation.module';

@Module({
  imports: [
    NestConfigModule.forRoot({ isGlobal: true }),
    MikroOrmModule.forRoot(config),
    PromptModule,
    TemplateModule,
    LlmModule,
    PluginModule,
    BlueprintModule,
    IntelligenceModule,
    WorkflowModule,
    ConversationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
