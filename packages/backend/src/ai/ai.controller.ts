import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';

class TestMessageDto {
  message: string;
}

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('test')
  async test(@Body() body: TestMessageDto): Promise<{ response: string }> {
    const response = await this.aiService.chat(
      'You are a helpful assistant.',
      body.message,
    );
    return { response };
  }
}
