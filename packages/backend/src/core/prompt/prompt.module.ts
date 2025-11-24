import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { Prompt } from "./prompt.entity";
import { PromptService } from "./prompt.service";

@Module({
    imports: [MikroOrmModule.forFeature([Prompt])],
    providers: [PromptService],
    exports: [PromptService],
})
export class PromptModule {}
