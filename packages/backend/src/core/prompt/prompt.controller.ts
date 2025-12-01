import { Controller, Post } from '@nestjs/common';
import { PromptService } from './prompt.service';

@Controller('prompts')
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  @Post('reload')
  async reload(): Promise<{ message: string; count: number }> {
    const count = await this.promptService.reloadPrompts();
    return {
      message: 'Prompts reloaded successfully',
      count,
    };
  }

  @Post('reseed')
  async reseed(): Promise<{ message: string; count: number }> {
    const count = await this.promptService.reseedPrompts();
    return {
      message: 'Prompts reseeded and reloaded successfully',
      count,
    };
  }
}
