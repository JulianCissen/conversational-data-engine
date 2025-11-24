import { Module } from "@nestjs/common";
import { LlmModule } from "../../core/llm/llm.module";
import { PromptModule } from "../../core/prompt/prompt.module";
import { TemplateModule } from "../../core/template/template.module";
import { InterpreterService } from "./interpreter.service";
import { PresenterService } from "./presenter.service";

@Module({
    imports: [LlmModule, PromptModule, TemplateModule],
    providers: [InterpreterService, PresenterService],
    exports: [InterpreterService, PresenterService],
})
export class IntelligenceModule {}
