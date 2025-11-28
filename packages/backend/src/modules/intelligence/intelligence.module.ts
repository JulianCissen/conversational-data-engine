import { Module, OnModuleInit } from '@nestjs/common';
import { LlmModule } from '../../core/llm/llm.module';
import { LanguageModule } from '../../core/language/language.module';
import { LanguageConfigService } from '../../core/language/language.service';
import { PromptModule } from '../../core/prompt/prompt.module';
import { PromptService } from '../../core/prompt/prompt.service';
import { TemplateModule } from '../../core/template/template.module';
import { TemplateService } from '../../core/template/template.service';
import { InterpreterService } from './interpreter.service';
import { PresenterService } from './presenter.service';
import { PromptExecutionService } from './prompt-execution.service';
import { SystemMessageBuilder } from './system-message.builder';

@Module({
  imports: [LlmModule, LanguageModule, PromptModule, TemplateModule],
  providers: [InterpreterService, PresenterService, PromptExecutionService],
  exports: [InterpreterService, PresenterService],
})
export class IntelligenceModule implements OnModuleInit {
  constructor(
    private readonly languageConfigService: LanguageConfigService,
    private readonly promptService: PromptService,
    private readonly templateService: TemplateService,
  ) {}

  /**
   * Initialize SystemMessageBuilder static dependencies on module startup.
   * This allows SystemMessageBuilder instances to be created without passing services through constructor.
   */
  onModuleInit() {
    const defaultConfig = this.languageConfigService.getDefaultLanguageConfig();
    SystemMessageBuilder.initialize(
      this.promptService,
      this.templateService,
      defaultConfig,
    );
  }
}
